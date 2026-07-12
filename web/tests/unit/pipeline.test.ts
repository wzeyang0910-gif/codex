import { describe, expect, it } from "vitest";
import { createMockAdapterSet } from "@/server/adapters/mock";
import type { AdapterSet, CandidateCompany, FoundContact } from "@/server/adapters/types";
import { runLeadPipeline } from "@/server/lead-engine/pipeline";

const input = {
  region: "Middle East",
  countries: ["Saudi Arabia"],
  productKeys: ["kinesiology_tape", "cohesive_bandage", "wound_plaster"],
  customerTypes: ["distributor", "wholesaler", "sports medicine distributor"],
  language: "English",
  extraKeywords: ["Saudi importer"],
  targetCount: 1
};

function company(name: string, website = `https://${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.example`): CandidateCompany {
  return {
    name,
    country: "Saudi Arabia",
    region: "Middle East",
    website,
    customerType: "medical distributor",
    businessSummary: "medical distributor of wound care and sports supplies",
    source: "Test directory",
    sourceUrl: `https://directory.example/${name}`,
    demandSignals: ["wound care catalog", "sports tape", "imports medical consumables"]
  };
}

function contact(overrides: Partial<FoundContact> = {}): FoundContact {
  return {
    name: "Amina Rahman",
    title: "Procurement Manager",
    email: "amina.rahman@example.com",
    emailStatus: "valid",
    source: "Test contact source",
    sourceUrl: "https://contacts.example/amina",
    isPrimary: true,
    ...overrides
  };
}

function adaptersFor(candidates: CandidateCompany[], contactLists: FoundContact[][]): AdapterSet {
  return {
    search: {
      async searchCompanies() {
        return candidates;
      }
    },
    contacts: {
      async findContacts(candidate) {
        return contactLists[candidates.indexOf(candidate)] ?? [];
      }
    }
  };
}

describe("lead pipeline", () => {
  it("returns 5 deliverable A/B customers with contacts and outreach", async () => {
    const result = await runLeadPipeline({ ...input, targetCount: 5 }, createMockAdapterSet());

    expect(result.delivered).toHaveLength(5);
    expect(result.delivered.every((lead) => ["A", "B"].includes(lead.grade))).toBe(true);
    expect(result.delivered.every((lead) => lead.contacts.length >= 1)).toBe(true);
    expect(result.delivered.every((lead) => lead.outreach.body.includes("Changzhou, China"))).toBe(true);
    expect(result.rejected.every((lead) => lead.reason.length > 0)).toBe(true);
    expect(result.marketSummary.summary).toContain("search strategy");
  });

  it("replaces an invalid first candidate with a later qualified candidate", async () => {
    const rejectedCompany = company("Invalid Contact Medical");
    const qualifiedCompany = company("Qualified Medical");
    const result = await runLeadPipeline(
      input,
      adaptersFor([rejectedCompany, qualifiedCompany], [[], [contact()]])
    );

    expect(result.delivered.map((lead) => lead.name)).toEqual([qualifiedCompany.name]);
    expect(result.rejected).toMatchObject([{ company: rejectedCompany, reason: expect.stringContaining("关键负责人") }]);
  });

  it("rejects a key person with an invalid email when only a junior person has a valid email", async () => {
    const candidate = company("Split Contact Medical");
    const result = await runLeadPipeline(
      input,
      adaptersFor([candidate], [
        [
          contact({ name: "Layla Owner", title: "Owner", email: "layla@example.com", emailStatus: "invalid" }),
          contact({ name: "Nora Assistant", title: "Sales Assistant", email: "nora@example.com", isPrimary: false })
        ]
      ])
    );

    expect(result.delivered).toEqual([]);
    expect(result.rejected).toMatchObject([{ company: candidate, reason: expect.stringContaining("关键负责人") }]);
  });

  it("rejects a generic mailbox even when its status is valid", async () => {
    const candidate = company("Generic Mailbox Medical");
    const result = await runLeadPipeline(
      input,
      adaptersFor([candidate], [
        [contact({ email: "info@example.com", title: "Managing Director" })]
      ])
    );

    expect(result.delivered).toEqual([]);
    expect(result.rejected[0]?.reason).toContain("个人工作邮箱");
  });

  it("rejects a duplicate candidate and continues to its replacement", async () => {
    const original = company("Duplicate Medical", "https://duplicate.example");
    const duplicate = company("Duplicate Medical Co.", "https://duplicate.example");
    const replacement = company("Replacement Medical");
    const result = await runLeadPipeline(
      { ...input, targetCount: 2 },
      adaptersFor([original, duplicate, replacement], [[contact()], [contact()], [contact()]])
    );

    expect(result.delivered.map((lead) => lead.name)).toEqual([original.name, replacement.name]);
    expect(result.rejected).toMatchObject([{ company: duplicate, reason: expect.stringContaining("重复公司") }]);
  });

  it("uses selected Yonye product display names in recommendations and outreach", async () => {
    const candidate = company("Product Name Medical");
    const result = await runLeadPipeline(
      input,
      adaptersFor([candidate], [[contact({ name: "Sara Founder", title: "Founder" })]])
    );

    expect(result.delivered[0]?.recommendedProducts).toEqual([
      "Kinesiology Tape Series",
      "Cohesive Bandage Series",
      "Wound Plaster Series"
    ]);
    expect(result.delivered[0]?.outreach.body).toContain("Kinesiology Tape Series");
  });
});
