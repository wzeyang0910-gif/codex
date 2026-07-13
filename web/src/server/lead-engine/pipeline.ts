import { extractDomain, normalizeCompanyName } from "@/lib/dedupe";
import { buildOutreachLetter } from "@/lib/outreach";
import { scoreLead } from "@/lib/scoring";
import type { AdapterSet, CandidateCompany, FoundContact } from "@/server/adapters/types";
import {
  rejectionReasonForDuplicate,
  rejectionReasonForMissingContact,
  rejectionReasonForScore
} from "./candidates";
import { selectBestEmailStatus, selectQualifyingContacts } from "./contacts";
import { buildMarketResearchSummary, selectRecommendedProducts } from "./market";

export type RunLeadPipelineInput = {
  region: string;
  countries: string[];
  productKeys: string[];
  customerTypes: string[];
  language: string;
  extraKeywords: string[];
  targetCount: number;
};

export type PipelineDeliveredLead = CandidateCompany & {
  normalizedName: string;
  domain: string | null;
  contacts: FoundContact[];
  grade: "A" | "B";
  score: number;
  scoreBreakdown: Record<string, number | boolean | string>;
  riskNotes: string[];
  recommendedProducts: string[];
  outreach: { subject: string; body: string };
};

export type PipelineRejectedLead = {
  company: CandidateCompany;
  reason: string;
};

export type PipelineResult = {
  marketSummary: ReturnType<typeof buildMarketResearchSummary>;
  searchedCount: number;
  delivered: PipelineDeliveredLead[];
  alternates: PipelineDeliveredLead[];
  rejected: PipelineRejectedLead[];
};

export function pipelineAlternateLimit(targetCount: number): number {
  return Math.max(targetCount, 5);
}

export function pipelineCandidateLimit(targetCount: number): number {
  return targetCount + pipelineAlternateLimit(targetCount);
}

function estimateProductFit(company: CandidateCompany) {
  const text = `${company.businessSummary} ${company.demandSignals.join(" ")}`.toLowerCase();
  return /kinesiology|sports|wound|bandage|orthopedic|first aid|pharmacy/.test(text) ? 88 : 58;
}

function estimateCompanySizeFit(company: CandidateCompany) {
  return /network|wholesale|trading|supplies|distributor|supplier/i.test(company.name + company.customerType) ? 82 : 65;
}

export async function runLeadPipeline(input: RunLeadPipelineInput, adapters: AdapterSet): Promise<PipelineResult> {
  const marketSummary = buildMarketResearchSummary(input);
  const candidates = (await adapters.search.searchCompanies({
    region: input.region,
    countries: input.countries,
    keywords: marketSummary.keywords,
    customerTypes: input.customerTypes
  })).slice(0, pipelineCandidateLimit(input.targetCount));
  const recommendedProducts = selectRecommendedProducts(input.productKeys);
  const delivered: PipelineDeliveredLead[] = [];
  const alternates: PipelineDeliveredLead[] = [];
  const rejected: PipelineRejectedLead[] = [];
  const seen = new Set<string>();

  for (const company of candidates) {
    const normalizedName = normalizeCompanyName(company.name);
    const domain = extractDomain(company.website);
    const dedupeNames = [normalizedName, ...(company.brandNames ?? []).map(normalizeCompanyName)].filter(Boolean);
    const duplicate = dedupeNames.some((name) => seen.has(`${name}:${company.country}:${company.region}`));

    if (duplicate || (domain && seen.has(`domain:${domain}:${company.country}:${company.region}`))) {
      rejected.push({ company, reason: rejectionReasonForDuplicate() });
      continue;
    }
    dedupeNames.forEach((name) => seen.add(`${name}:${company.country}:${company.region}`));
    if (domain) seen.add(`domain:${domain}:${company.country}:${company.region}`);

    const qualifyingContacts = selectQualifyingContacts(await adapters.contacts.findContacts(company));
    if (qualifyingContacts.length === 0) {
      rejected.push({ company, reason: rejectionReasonForMissingContact() });
      continue;
    }

    const bestEmailStatus = selectBestEmailStatus(qualifyingContacts);
    const score = scoreLead({
      productFit: estimateProductFit(company),
      demandEvidenceCount: company.demandSignals.length,
      hasImportEvidence: company.demandSignals.some((signal) => /import/i.test(signal)),
      hasKeyPerson: true,
      bestEmailStatus,
      companySizeFit: estimateCompanySizeFit(company)
    });

    if (!score.deliverable || (score.grade !== "A" && score.grade !== "B")) {
      rejected.push({ company, reason: rejectionReasonForScore() });
      continue;
    }

    const primaryContact = qualifyingContacts[0];
    const outreach = buildOutreachLetter({
      companyName: company.name,
      businessSummary: company.businessSummary,
      recommendedProducts,
      contactName: primaryContact.name,
      language: input.language
    });

    const qualifiedLead: PipelineDeliveredLead = {
      ...company,
      normalizedName,
      domain,
      contacts: qualifyingContacts,
      grade: score.grade,
      score: score.score,
      scoreBreakdown: score.breakdown,
      riskNotes: score.riskNotes,
      recommendedProducts,
      outreach
    };
    if (delivered.length < input.targetCount) delivered.push(qualifiedLead);
    else if (alternates.length < pipelineAlternateLimit(input.targetCount)) alternates.push(qualifiedLead);
  }

  return { marketSummary, searchedCount: candidates.length, delivered, alternates, rejected };
}
