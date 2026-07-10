import { describe, expect, it } from "vitest";
import { normalizeEvidence } from "@/lib/evidence";

describe("evidence normalization", () => {
  it("keeps source title, URL, type and summary for auditability", () => {
    const evidence = normalizeEvidence({
      type: "customs",
      title: "China export shipment signal",
      url: "https://example.com/customs",
      summary: "Buyer imported adhesive bandage products from China."
    });

    expect(evidence.type).toBe("customs");
    expect(evidence.url).toBe("https://example.com/customs");
    expect(evidence.summary).toContain("adhesive bandage");
    expect(evidence.collectedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
