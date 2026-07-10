export type EvidenceInput = {
  type: string;
  title: string;
  url?: string | null;
  summary: string;
};

export type EvidenceOutput = EvidenceInput & {
  collectedAt: string;
};

export function normalizeEvidence(input: EvidenceInput): EvidenceOutput {
  const url = input.url?.trim() || undefined;

  return {
    type: input.type.trim(),
    title: input.title.trim(),
    ...(url ? { url } : {}),
    summary: input.summary.trim(),
    collectedAt: new Date().toISOString()
  };
}
