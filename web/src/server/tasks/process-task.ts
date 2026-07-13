import type { LeadTaskStatus } from "@prisma/client";
import { extractDomain, normalizeCompanyName } from "@/lib/dedupe";
import { prisma as defaultPrisma } from "@/lib/db";
import { createAdapterSet } from "@/server/adapters/mock";
import type { AdapterSet, CandidateCompany } from "@/server/adapters/types";
import {
  pipelineCandidateLimit,
  runLeadPipeline,
  type PipelineDeliveredLead,
  type PipelineResult,
  type RunLeadPipelineInput
} from "@/server/lead-engine/pipeline";

type ExistingCompany = {
  normalizedName: string;
  domain: string | null;
  country: string;
  region: string;
  brands?: { normalizedName: string }[];
};

type TaskRecord = {
  id: string;
  userId: string;
  targetRegion: string;
  targetCountries: string[];
  productKeys: string[];
  customerTypes: string[];
  language: string;
  extraKeywords: string[];
  targetCount: number;
};

type TaskProcessingPrisma = {
  leadTask: {
    findUnique(args: { where: { id: string } }): Promise<TaskRecord | null>;
    update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<unknown>;
    updateMany(args: { where: Record<string, unknown>; data: Record<string, unknown> }): Promise<{ count: number }>;
  };
  company: {
    findMany(args: { where: Record<string, unknown>; select: Record<string, unknown>; take: number }): Promise<ExistingCompany[]>;
    create(args: { data: ReturnType<typeof buildCompanyCreateData> }): Promise<unknown>;
    count(args: { where: { taskId: string; isDelivered: true } }): Promise<number>;
  };
  $transaction(callback: (transaction: TaskProcessingTransaction) => Promise<unknown>): Promise<unknown>;
};

type TaskProcessingTransaction = {
  leadTask: {
    updateMany(args: { where: Record<string, unknown>; data: Record<string, unknown> }): Promise<{ count: number }>;
  };
  company: {
    create(args: { data: ReturnType<typeof buildCompanyCreateData> }): Promise<unknown>;
  };
};

export const STALE_RUNNING_TASK_MS = 15 * 60 * 1000;
const GLOBAL_DEDUPE_RECALL_MULTIPLIER = 3;
const GLOBAL_DEDUPE_RECALL_MAX = 100;

export type ProcessLeadTaskDependencies = {
  prisma?: TaskProcessingPrisma;
  createAdapters?: () => AdapterSet;
  runPipeline?: (input: RunLeadPipelineInput, adapters: AdapterSet) => Promise<PipelineResult>;
  now?: () => Date;
};

function existingKey(company: ExistingCompany): string {
  return `${company.normalizedName}:${company.country}:${company.region}`;
}

function existingDomainKey(company: ExistingCompany): string | null {
  return company.domain ? `${company.domain}:${company.country}:${company.region}` : null;
}

export function filterExistingCompanies(
  candidates: CandidateCompany[],
  existingCompanies: ExistingCompany[]
): CandidateCompany[] {
  const normalizedKeys = new Set(existingCompanies.map(existingKey));
  existingCompanies.forEach((company) => company.brands?.forEach((brand) => {
    normalizedKeys.add(`${brand.normalizedName}:${company.country}:${company.region}`);
  }));
  const domainKeys = new Set(existingCompanies.map(existingDomainKey).filter((value): value is string => !!value));

  return candidates.filter((candidate) => {
    const normalizedNames = [candidate.name, ...(candidate.brandNames ?? [])].map(normalizeCompanyName).filter(Boolean);
    const domain = extractDomain(candidate.website);
    const domainKey = domain ? `${domain}:${candidate.country}:${candidate.region}` : null;

    return !normalizedNames.some((name) => normalizedKeys.has(`${name}:${candidate.country}:${candidate.region}`)) && (!domainKey || !domainKeys.has(domainKey));
  });
}

function existingCompanyWhere(candidates: CandidateCompany[]): Record<string, unknown> {
  const groups = new Map<string, { country: string; region: string; names: Set<string>; domains: Set<string> }>();

  for (const candidate of candidates) {
    const key = `${candidate.country}\u0000${candidate.region}`;
    const group = groups.get(key) ?? {
      country: candidate.country,
      region: candidate.region,
      names: new Set<string>(),
      domains: new Set<string>()
    };
    [candidate.name, ...(candidate.brandNames ?? [])]
      .map(normalizeCompanyName)
      .filter(Boolean)
      .forEach((name) => group.names.add(name));
    const domain = extractDomain(candidate.website);
    if (domain) group.domains.add(domain);
    groups.set(key, group);
  }

  return {
    OR: [...groups.values()].flatMap((group) => {
      const names = [...group.names];
      const domains = [...group.domains];
      return [
        { normalizedName: { in: names }, country: group.country, region: group.region },
        ...(domains.length > 0 ? [{ domain: { in: domains }, country: group.country, region: group.region }] : []),
        {
          brands: {
            some: {
              normalizedName: { in: names },
              country: group.country,
              region: group.region
            }
          }
        }
      ];
    })
  };
}

function applyGlobalDedupe(
  adapters: AdapterSet,
  companyPrisma: TaskProcessingPrisma["company"],
  targetCount: number
): AdapterSet {
  return {
    ...adapters,
    search: {
      async searchCompanies(input) {
        const candidateLimit = pipelineCandidateLimit(targetCount);
        const recallLimit = Math.min(candidateLimit * GLOBAL_DEDUPE_RECALL_MULTIPLIER, GLOBAL_DEDUPE_RECALL_MAX);
        const candidates = (await adapters.search.searchCompanies(input)).slice(0, recallLimit);
        if (candidates.length === 0) return [];
        const existingCompanies = await companyPrisma.findMany({
          where: existingCompanyWhere(candidates),
          select: {
            normalizedName: true,
            domain: true,
            country: true,
            region: true,
            brands: { select: { normalizedName: true } }
          },
          take: recallLimit
        });
        return filterExistingCompanies(candidates, existingCompanies).slice(0, candidateLimit);
      }
    }
  };
}

export function buildCompanyCreateData(task: TaskRecord, lead: PipelineDeliveredLead, deliveredAt: Date) {
  const legalIdentity = {
    name: lead.name,
    normalizedName: lead.normalizedName,
    country: lead.country,
    region: lead.region
  };
  const seenBrands = new Set<string>([lead.normalizedName]);
  const brands = (lead.brandNames ?? []).flatMap((name) => {
    const trimmed = name.trim();
    const normalizedName = normalizeCompanyName(trimmed);
    if (!trimmed || !normalizedName || seenBrands.has(normalizedName)) return [];
    seenBrands.add(normalizedName);
    return [{ name: trimmed, normalizedName, country: lead.country, region: lead.region }];
  });
  return {
    taskId: task.id,
    ownerId: task.userId,
    name: lead.name,
    normalizedName: lead.normalizedName,
    country: lead.country,
    region: lead.region,
    city: lead.city,
    website: lead.website,
    domain: lead.domain,
    brandNames: brands.map((brand) => brand.name),
    brands: { create: [legalIdentity, ...brands] },
    customerType: lead.customerType,
    businessSummary: lead.businessSummary,
    demandEvidence: lead.demandSignals.join("\n"),
    recommendedProducts: lead.recommendedProducts,
    grade: lead.grade,
    score: lead.score,
    scoreBreakdown: lead.scoreBreakdown,
    isDelivered: true,
    deliveredAt,
    contacts: {
      create: lead.contacts.map((contact) => ({
        name: contact.name,
        title: contact.title,
        email: contact.email,
        emailStatus: contact.emailStatus,
        source: contact.source,
        sourceUrl: contact.sourceUrl,
        isPrimary: contact.isPrimary,
        riskNote: contact.riskNote
      }))
    },
    evidences: {
      create: [
        {
          type: "source",
          title: lead.source,
          url: lead.sourceUrl,
          summary: lead.businessSummary
        },
        ...lead.demandSignals.map((signal) => ({
          type: "demand_signal",
          title: signal,
          url: lead.sourceUrl,
          summary: signal
        }))
      ]
    },
    letters: {
      create: [
        {
          subject: lead.outreach.subject,
          body: lead.outreach.body,
          language: task.language
        }
      ]
    }
  };
}

export function taskStatusForDeliveredCount(deliveredCount: number, targetCount: number): LeadTaskStatus {
  return deliveredCount >= targetCount ? "completed" : "partial";
}

function isPrismaP2002(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

class LeaseLostError extends Error {}

function nextFenceAt(now: () => Date, currentFence: Date): Date {
  const candidate = now();
  return candidate.getTime() > currentFence.getTime()
    ? candidate
    : new Date(currentFence.getTime() + 1);
}

export async function processLeadTask(taskId: string, dependencies: ProcessLeadTaskDependencies = {}): Promise<void> {
  const taskPrisma = dependencies.prisma ?? (defaultPrisma as unknown as TaskProcessingPrisma);
  const now = dependencies.now ?? (() => new Date());
  const claimedAt = now();
  let currentFence = claimedAt;
  let claimed = false;

  try {
    const claim = await taskPrisma.leadTask.updateMany({
      where: {
        id: taskId,
        OR: [
          { status: "queued" },
          { status: "running", startedAt: { lt: new Date(claimedAt.getTime() - STALE_RUNNING_TASK_MS) } }
        ]
      },
      data: { status: "running", startedAt: claimedAt, completedAt: null }
    });
    if (claim.count !== 1) return;
    claimed = true;

    const task = await taskPrisma.leadTask.findUnique({ where: { id: taskId } });

    if (!task) {
      return;
    }

    const adapters = applyGlobalDedupe(
      (dependencies.createAdapters ?? createAdapterSet)(),
      taskPrisma.company,
      task.targetCount
    );
    const result = await (dependencies.runPipeline ?? runLeadPipeline)(
      {
        region: task.targetRegion,
        countries: task.targetCountries,
        productKeys: task.productKeys,
        customerTypes: task.customerTypes,
        language: task.language,
        extraKeywords: task.extraKeywords,
        targetCount: task.targetCount
      },
      adapters
    );
    let deliveredCount = await taskPrisma.company.count({ where: { taskId, isDelivered: true } });
    let duplicateCount = 0;

    for (const lead of [...result.delivered, ...result.alternates]) {
      if (deliveredCount >= task.targetCount) break;
      const renewedAt = nextFenceAt(now, currentFence);
      try {
        await taskPrisma.$transaction(async (transaction) => {
          const renewal = await transaction.leadTask.updateMany({
            where: { id: taskId, status: "running", startedAt: currentFence },
            data: { startedAt: renewedAt }
          });
          if (renewal.count !== 1) throw new LeaseLostError();

          await transaction.company.create({
            data: buildCompanyCreateData(task, lead, renewedAt)
          });
        });
        currentFence = renewedAt;
        deliveredCount += 1;
      } catch (error) {
        if (error instanceof LeaseLostError) return;
        if (isPrismaP2002(error)) {
          duplicateCount += 1;
          continue;
        }

        throw error;
      }
    }

    deliveredCount = await taskPrisma.company.count({ where: { taskId, isDelivered: true } });

    await taskPrisma.leadTask.updateMany({
      where: { id: taskId, status: "running", startedAt: currentFence },
      data: {
        status: taskStatusForDeliveredCount(deliveredCount, task.targetCount),
        deliveredCount,
        searchedCount: result.searchedCount,
        rejectedCount: result.rejected.length + duplicateCount,
        completedAt: now()
      }
    });
  } catch {
    if (!claimed) return;
    try {
      await taskPrisma.leadTask.updateMany({
        where: { id: taskId, status: "running", startedAt: currentFence },
        data: { status: "failed", completedAt: now() }
      });
    } catch {
      // A failed-status update is best effort; this worker must never reject outward.
    }
  }
}
