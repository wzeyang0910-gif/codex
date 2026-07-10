import { describe, expect, it } from "vitest";
import { scoreLead } from "@/lib/scoring";

describe("lead scoring", () => {
  it("grades a strong importer with verified owner email as A", () => {
    const result = scoreLead({
      productFit: 90,
      demandEvidenceCount: 3,
      hasImportEvidence: true,
      hasKeyPerson: true,
      bestEmailStatus: "valid",
      companySizeFit: 85
    });

    expect(result.grade).toBe("A");
    expect(result.deliverable).toBe(true);
  });

  it("grades accept-all email as B at best and marks the risk", () => {
    const result = scoreLead({
      productFit: 90,
      demandEvidenceCount: 3,
      hasImportEvidence: true,
      hasKeyPerson: true,
      bestEmailStatus: "accept_all",
      companySizeFit: 85
    });

    expect(result.grade).toBe("B");
    expect(result.riskNotes).toContain("閭涓?accept-all锛屽彧鑳戒綔涓?B 绫诲鎴穈");
  });

  it("rejects companies without personal work email", () => {
    const result = scoreLead({
      productFit: 80,
      demandEvidenceCount: 2,
      hasImportEvidence: false,
      hasKeyPerson: true,
      bestEmailStatus: "unknown",
      companySizeFit: 80
    });

    expect(result.deliverable).toBe(false);
    expect(result.grade).toBe("rejected");
  });

  it("rejects companies without a key person", () => {
    const result = scoreLead({
      productFit: 90,
      demandEvidenceCount: 3,
      hasImportEvidence: true,
      hasKeyPerson: false,
      bestEmailStatus: "valid",
      companySizeFit: 85
    });

    expect(result.deliverable).toBe(false);
    expect(result.grade).toBe("rejected");
  });
});
