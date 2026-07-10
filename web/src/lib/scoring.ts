import { EmailStatus, LeadGrade } from "@prisma/client";

export type ScoreLeadInput = {
  productFit: number;
  demandEvidenceCount: number;
  hasImportEvidence: boolean;
  hasKeyPerson: boolean;
  bestEmailStatus: EmailStatus;
  companySizeFit: number;
};

export type ScoreLeadResult = {
  score: number;
  grade: LeadGrade;
  deliverable: boolean;
  riskNotes: string[];
  breakdown: {
    productFit: number;
    demandEvidence: number;
    importEvidence: number;
    keyPerson: number;
    emailQuality: number;
    companySizeFit: number;
  };
};

const ACCEPT_ALL_RISK_NOTE = "閭涓?accept-all锛屽彧鑳戒綔涓?B 绫诲鎴穈";

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function rejectedResult(reason: string, breakdown: ScoreLeadResult["breakdown"]): ScoreLeadResult {
  return {
    score: 0,
    grade: "rejected",
    deliverable: false,
    riskNotes: [reason],
    breakdown
  };
}

export function scoreLead(input: ScoreLeadInput): ScoreLeadResult {
  const breakdown = {
    productFit: clampScore(input.productFit) * 0.35,
    demandEvidence: Math.min(input.demandEvidenceCount, 3) * 8,
    importEvidence: input.hasImportEvidence ? 12 : 0,
    keyPerson: input.hasKeyPerson ? 10 : 0,
    emailQuality: input.bestEmailStatus === "valid" ? 12 : input.bestEmailStatus === "accept_all" ? 6 : 0,
    companySizeFit: clampScore(input.companySizeFit) * 0.07
  };

  if (!input.hasKeyPerson) {
    return rejectedResult("Missing key person with personal work email.", breakdown);
  }

  if (input.bestEmailStatus !== "valid" && input.bestEmailStatus !== "accept_all") {
    return rejectedResult("Missing valid personal work email.", breakdown);
  }

  const score = clampScore(
    breakdown.productFit +
      breakdown.demandEvidence +
      breakdown.importEvidence +
      breakdown.keyPerson +
      breakdown.emailQuality +
      breakdown.companySizeFit
  );
  const riskNotes: string[] = [];
  let grade: LeadGrade = score >= 85 ? "A" : score >= 70 ? "B" : "C";

  if (input.bestEmailStatus === "accept_all") {
    riskNotes.push(ACCEPT_ALL_RISK_NOTE);
    if (grade === "A") {
      grade = "B";
    }
  }

  return {
    score,
    grade,
    deliverable: grade === "A" || grade === "B",
    riskNotes,
    breakdown
  };
}
