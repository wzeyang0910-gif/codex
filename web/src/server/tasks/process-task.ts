import type { LeadTaskStatus } from "@prisma/client";
import { extractDomain, normalizeCompanyName } from "@/lib/dedupe";
import { prisma as defaultPrisma } from "@/lib/db";
import { createAdapterSet } from "@/server/adapters/mock";
import type { AdapterSet, CandidateCompany } from "@/server/adapters/types";
import {
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
  };
  company: {
    findMany(args: { select: Record<string, boolean> }): Promise<ExistingCompany[]>;
    create(args: { data: ReturnType<typeof buildCompanyCreateData> }): Promise<unknown>;
  };
};

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
  const domainKeys = new Set(existingCompanies.map(existingDomainKey).filter((value): value is string => !!value));

  return candidates.filter((candidate) => {
    const normalizedName = normalizeCompanyName(candidate.name);
    const domain = extractDomain(candidate.website);
    const normalizedKey = `${normalizedName}:${candidate.country}:${candidate.region}`;
    const domainKey = domain ? `${domain}:${candidate.country}:${candidate.region}` : null;

    return !normalizedKeys.has(normalizedKey) && (!domainKey || !domainKeys.has(domainKey));
  });
}

function applyGlobalDedupe(adapters: AdapterSet, existingCompanies: ExistingCompany[]): AdapterSet {
  return {
    ...adapters,
    search: {
      async searchCompanies(input) {
        return filterExistingCompanies(await adapters.search.searchCompanies(input), existingCompanies);
      }
    }
  };
}

export function buildCompanyCreateData(task: TaskRecord, lead: PipelineDeliveredLead, deliveredAt: Date) {
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
    brandNames: [],
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

export async function processLeadTask(taskId: string, dependencies: ProcessLeadTaskDependencies = {}): Promise<void> {
  const taskPrisma = dependencies.prisma ?? (defaultPrisma as unknown as TaskProcessingPrisma);
  const now = dependencies.now ?? (() => new Date());

  try {
    const task = await taskPrisma.leadTask.findUnique({ where: { id: taskId } });

    if (!task) {
      return;
    }

    await taskPrisma.leadTask.update({
      where: { id: taskId },
      data: { status: "running", startedAt: now() }
    });

    const existingCompanies = await taskPrisma.company.findMany({
      select: { normalizedName: true, domain: true, country: true, region: true }
    });
    const adapters = applyGlobalDedupe((dependencies.createAdapters ?? createAdapterSet)(), existingCompanies);
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
    const deliveredAt = now();
    let deliveredCount = 0;
    let duplicateCount = 0;

    for (const lead of result.delivered) {
      try {
        await taskPrisma.company.create({
          data: buildCompanyCreateData(task, lead, deliveredAt)
        });
        deliveredCount += 1;
      } catch (error) {
        if (isPrismaP2002(error)) {
          duplicateCount += 1;
          continue;
        }

        throw error;
      }
    }

    await taskPrisma.leadTask.update({
      where: { id: taskId },
      data: {
        status: taskStatusForDeliveredCount(deliveredCount, task.targetCount),
        deliveredCount,
        searchedCount: result.searchedCount,
        rejectedCount: result.rejected.length + duplicateCount,
        completedAt: now()
      }
    });
  } catch {
    try {
      await taskPrisma.leadTask.update({
        where: { id: taskId },
        data: { status: "failed", completedAt: now() }
      });
    } catch {
      // A failed-status update is best effort; this worker must never reject outward.
    }
  }
}
