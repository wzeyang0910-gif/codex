import { describe, expect, it, vi } from "vitest";
import { createConfiguredAdapterSet } from "@/server/adapters/configured";
import type { AdapterSet, CandidateCompany, ContactAdapter, SearchAdapter } from "@/server/adapters/types";

const company: CandidateCompany = {
  name: "Riyadh Medical Trading",
  country: "Saudi Arabia",
  region: "Middle East",
  website: "https://riyadh-medical.example",
  customerType: "medical distributor",
  businessSummary: "Distributes medical consumables.",
  source: "Prospeo Company Search",
  sourceUrl: "https://riyadh-medical.example",
  demandSignals: ["wound care"]
};

const mockAdapters: AdapterSet = {
  search: { searchCompanies: vi.fn(async () => [company]) },
  contacts: { findContacts: vi.fn(async () => []) }
};

describe("configured adapters", () => {
  it("uses mock adapters when mock mode is enabled", () => {
    const mockFactory = vi.fn(() => mockAdapters);

    const adapters = createConfiguredAdapterSet({
      environment: { USE_MOCK_ADAPTERS: "true" },
      mockFactory
    });

    expect(adapters).toBe(mockAdapters);
    expect(mockFactory).toHaveBeenCalledTimes(1);
  });

  it("requires at least one company search provider in live mode", () => {
    expect(() => createConfiguredAdapterSet({
      environment: { USE_MOCK_ADAPTERS: "false" }
    })).toThrow("At least one live company search provider is required");
  });

  it("uses Apify company search when Prospeo is unavailable", async () => {
    const apifySearch: SearchAdapter = { searchCompanies: vi.fn(async () => [company]) };
    const adapters = createConfiguredAdapterSet({
      environment: {
        USE_MOCK_ADAPTERS: "false",
        APIFY_API_KEY: "apify-key",
        HUNTER_API_KEY: "hunter-key"
      },
      apifySearchFactory: () => apifySearch,
      hunterContactFactory: () => ({ findContacts: vi.fn(async () => []) })
    });

    await expect(adapters.search.searchCompanies({
      region: "Middle East",
      countries: ["Saudi Arabia"],
      keywords: ["medical tape"],
      customerTypes: ["distributor"]
    })).resolves.toEqual([company]);
  });

  it("keeps Apify company results when Prospeo search fails", async () => {
    const adapters = createConfiguredAdapterSet({
      environment: {
        USE_MOCK_ADAPTERS: "false",
        PROSPEO_API_KEY: "prospeo-key",
        APIFY_API_KEY: "apify-key",
        HUNTER_API_KEY: "hunter-key"
      },
      prospeoSearchFactory: () => ({ searchCompanies: vi.fn(async () => { throw new Error("no credits"); }) }),
      prospeoContactFactory: () => ({ findContacts: vi.fn(async () => []) }),
      apifySearchFactory: () => ({ searchCompanies: vi.fn(async () => [company]) }),
      hunterContactFactory: () => ({ findContacts: vi.fn(async () => []) })
    });

    await expect(adapters.search.searchCompanies({
      region: "Middle East",
      countries: ["Saudi Arabia"],
      keywords: ["medical tape"],
      customerTypes: ["distributor"]
    })).resolves.toEqual([company]);
  });

  it("uses Prospeo search and merges verified contacts from available providers", async () => {
    const searchAdapter: SearchAdapter = { searchCompanies: vi.fn(async () => [company]) };
    const prospeoContacts: ContactAdapter = {
      findContacts: vi.fn(async () => [{
        name: "Amina Rahman",
        title: "Founder and CEO",
        email: "amina@riyadh-medical.example",
        emailStatus: "valid" as const,
        source: "Prospeo",
        sourceUrl: "https://example.com/amina",
        isPrimary: true
      }])
    };
    const hunterContacts: ContactAdapter = {
      findContacts: vi.fn(async () => [
        {
          name: "Amina Rahman",
          title: "Founder and CEO",
          email: "amina@riyadh-medical.example",
          emailStatus: "valid" as const,
          source: "Hunter",
          sourceUrl: "https://example.com/amina",
          isPrimary: true
        },
        {
          name: "Fahad Al-Salem",
          title: "Procurement Manager",
          email: "fahad@riyadh-medical.example",
          emailStatus: "valid" as const,
          source: "Hunter",
          sourceUrl: "https://example.com/fahad",
          isPrimary: false
        }
      ])
    };
    const adapters = createConfiguredAdapterSet({
      environment: {
        USE_MOCK_ADAPTERS: "false",
        PROSPEO_API_KEY: "prospeo-key",
        HUNTER_API_KEY: "hunter-key"
      },
      prospeoSearchFactory: () => searchAdapter,
      prospeoContactFactory: () => prospeoContacts,
      hunterContactFactory: () => hunterContacts
    });

    await expect(adapters.search.searchCompanies({
      region: "Middle East",
      countries: ["Saudi Arabia"],
      keywords: ["wound care"],
      customerTypes: ["distributor"]
    })).resolves.toEqual([company]);
    await expect(adapters.contacts.findContacts(company)).resolves.toEqual([
      expect.objectContaining({ email: "amina@riyadh-medical.example", isPrimary: true }),
      expect.objectContaining({ email: "fahad@riyadh-medical.example", isPrimary: false })
    ]);
  });

  it("keeps the remaining contact provider when another provider fails", async () => {
    const fallbackContact = {
      name: "Fahad Al-Salem",
      title: "Procurement Manager",
      email: "fahad@riyadh-medical.example",
      emailStatus: "valid" as const,
      source: "Hunter",
      sourceUrl: "https://example.com/fahad",
      isPrimary: true
    };
    const adapters = createConfiguredAdapterSet({
      environment: {
        USE_MOCK_ADAPTERS: "false",
        PROSPEO_API_KEY: "prospeo-key",
        HUNTER_API_KEY: "hunter-key"
      },
      prospeoSearchFactory: () => ({ searchCompanies: vi.fn(async () => []) }),
      prospeoContactFactory: () => ({ findContacts: vi.fn(async () => { throw new Error("temporary"); }) }),
      hunterContactFactory: () => ({ findContacts: vi.fn(async () => [fallbackContact]) })
    });

    await expect(adapters.contacts.findContacts(company)).resolves.toEqual([fallbackContact]);
  });
});
