import { describe, expect, it } from "vitest";
import { createMockAdapterSet } from "@/server/adapters/mock";

describe("mock adapter set", () => {
  it("returns candidates and verified contacts with source evidence", async () => {
    const adapters = createMockAdapterSet();
    const candidates = await adapters.search.searchCompanies({
      region: "Middle East",
      countries: ["Saudi Arabia"],
      keywords: ["kinesiology tape", "medical distributor"],
      customerTypes: ["distributor"]
    });

    expect(candidates.length).toBeGreaterThanOrEqual(5);
    expect(candidates[0].sourceUrl).toContain("https://");

    const contacts = await adapters.contacts.findContacts(candidates[0]);
    expect(contacts[0].emailStatus).toMatch(/valid|accept_all/);
    expect(contacts[0].source).toBeTruthy();
  });

  it("keeps Saudi-only search results and provides a key contact for the added company", async () => {
    const adapters = createMockAdapterSet();
    const candidates = await adapters.search.searchCompanies({
      region: "Middle East",
      countries: ["Saudi Arabia"],
      keywords: ["kinesiology tape", "medical distributor"],
      customerTypes: ["distributor"]
    });

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
});
