import { describe, expect, it } from "vitest";
import { createAdapterSet, createMockAdapterSet } from "@/server/adapters/mock";
import { getProspeoConfig } from "@/server/adapters/prospeo";

const saudiDistributorSearch = {
  region: "Middle East",
  countries: ["Saudi Arabia"],
  keywords: ["kinesiology tape", "medical distributor"],
  customerTypes: ["distributor"]
};

describe("mock adapter set", () => {
  it("returns candidates and verified contacts with source evidence", async () => {
    const adapters = createMockAdapterSet();
    const candidates = await adapters.search.searchCompanies(saudiDistributorSearch);

    expect(candidates.length).toBeGreaterThanOrEqual(5);
    expect(candidates[0].sourceUrl).toContain("https://");

    const contacts = await adapters.contacts.findContacts(candidates[0]);
    expect(contacts[0].emailStatus).toMatch(/valid|accept_all/);
    expect(contacts[0].source).toBeTruthy();
  });

  it("keeps Saudi-only search results and provides a key contact for the added company", async () => {
    const adapters = createMockAdapterSet();
    const candidates = await adapters.search.searchCompanies(saudiDistributorSearch);

    expect(candidates).toHaveLength(5);
    expect(candidates.every((candidate) => candidate.country === "Saudi Arabia")).toBe(true);

    const company = candidates.find((candidate) => candidate.name === "Dammam Medical Distribution Co.");
    expect(company).toBeDefined();

    const contacts = await adapters.contacts.findContacts(company!);
    expect(contacts[0]).toMatchObject({
      name: "Noura Al-Harbi",
      title: "Procurement Director",
      emailStatus: "valid",
      isPrimary: true
    });
  });

  it("requires the requested region", async () => {
    const candidates = await createMockAdapterSet().search.searchCompanies({
      ...saudiDistributorSearch,
      region: "Europe"
    });

    expect(candidates).toEqual([]);
  });

  it("requires requested countries even when another company matches a keyword", async () => {
    const candidates = await createMockAdapterSet().search.searchCompanies({
      ...saudiDistributorSearch,
      countries: ["United Arab Emirates"],
      keywords: ["medical distributor"]
    });

    expect(candidates).toEqual([]);
  });

  it("matches customer-type phrases by containment", async () => {
    const candidates = await createMockAdapterSet().search.searchCompanies({
      ...saudiDistributorSearch,
      customerTypes: ["sports medicine distributor"],
      keywords: ["kinesiology tape"]
    });

    expect(candidates.map((candidate) => candidate.name)).toEqual(["Gulf Sports Medicine Trading"]);
  });

  it("requires at least one complete keyword phrase", async () => {
    const candidates = await createMockAdapterSet().search.searchCompanies({
      ...saudiDistributorSearch,
      keywords: ["orthopedic surgery"]
    });

    expect(candidates).toEqual([]);
  });

  it("exposes the mock adapter set through the public factory", async () => {
    const candidates = await createAdapterSet().search.searchCompanies(saudiDistributorSearch);

    expect(candidates).toHaveLength(5);
    expect(candidates.every((candidate) => candidate.country === "Saudi Arabia")).toBe(true);
  });

  it("keeps accept-all risk and source URL evidence on contacts", async () => {
    const adapters = createMockAdapterSet();
    const [company] = await adapters.search.searchCompanies({
      ...saudiDistributorSearch,
      keywords: ["acne patch"]
    });
    const [contact] = await adapters.contacts.findContacts(company!);

    expect(company.name).toBe("Jeddah Pharmacy Supply Network");
    expect(contact).toMatchObject({
      name: "Fatima Almutairi",
      title: "Procurement Manager",
      emailStatus: "accept_all",
      riskNote: "accept-all domain, confirm before outreach",
      sourceUrl: company.sourceUrl
    });
    expect(contact.email).toMatch(/^fatima\.almutairi@/);
  });
});

describe("provider config", () => {
  it("rejects client-runtime access", () => {
    expect(() => getProspeoConfig()).toThrow(/server runtime/i);
  });
});
