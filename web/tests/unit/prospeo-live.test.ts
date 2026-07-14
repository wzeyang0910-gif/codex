import { describe, expect, it, vi } from "vitest";
import {
  buildProspeoCompanySearchPayload,
  buildProspeoPersonSearchPayload,
  createProspeoContactAdapter,
  createProspeoSearchAdapter
} from "@/server/adapters/prospeo";
import type { CandidateCompany, CompanySearchInput } from "@/server/adapters/types";

const searchInput: CompanySearchInput = {
  region: "Middle East",
  countries: ["Saudi Arabia"],
  keywords: Array.from({ length: 24 }, (_, index) => `medical keyword ${index + 1}`),
  customerTypes: ["distributor", "wholesaler"]
};

const candidate: CandidateCompany = {
  name: "Riyadh Medical Trading",
  country: "Saudi Arabia",
  region: "Middle East",
  city: "Riyadh",
  website: "https://riyadh-medical.example",
  customerType: "Hospitals and Health Care",
  businessSummary: "Distributes wound care, rehabilitation and medical consumables.",
  source: "Prospeo Company Search",
  sourceUrl: "https://riyadh-medical.example",
  demandSignals: ["medical keyword 1"]
};

describe("Prospeo live adapters", () => {
  it("builds a bounded B2B company search for the requested countries and keywords", () => {
    expect(buildProspeoCompanySearchPayload(searchInput)).toEqual({
      page: 1,
      filters: {
        company_location_search: { include: ["Saudi Arabia"] },
        company_headcount_range: ["11-20", "21-50", "51-100", "101-200", "201-500", "501-1000"],
        company_attributes: { b2b: true },
        company_keywords: {
          include: searchInput.keywords.slice(0, 20),
          include_all: false,
          search_everywhere: true
        }
      }
    });
  });

  it("maps Prospeo company results into traceable candidates", async () => {
    const onCall = vi.fn();
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({
      error: false,
      results: [{
        company: {
          name: candidate.name,
          website: candidate.website,
          domain: "riyadh-medical.example",
          description: "Medical distributor for hospital supplies.",
          description_ai: candidate.businessSummary,
          industry: candidate.customerType,
          location: { country: candidate.country, city: candidate.city },
          keywords: ["medical keyword 1", "hospital supplier"]
        }
      }]
    }), { status: 200 }));
    const fetchImpl = fetchMock as unknown as typeof fetch;
    const adapter = createProspeoSearchAdapter({ apiKey: "test-key", fetchImpl, onCall });

    const result = await adapter.searchCompanies(searchInput);

    expect(result).toEqual([candidate]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.prospeo.io/search-company");
    expect(init?.method).toBe("POST");
    expect(new Headers(init?.headers).get("X-KEY")).toBe("test-key");
    expect(onCall).toHaveBeenCalledWith(expect.objectContaining({
      provider: "Prospeo",
      endpoint: "search-company",
      status: "success",
      creditsUsed: 0,
      durationMs: expect.any(Number)
    }));
  });

  it("reports failed Prospeo calls without exposing the API key", async () => {
    const onCall = vi.fn();
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response(JSON.stringify({ error: true, error_code: "RATE_LIMIT" }), { status: 429 })
    ) as unknown as typeof fetch;
    const adapter = createProspeoSearchAdapter({ apiKey: "secret-test-key", fetchImpl, onCall });

    await expect(adapter.searchCompanies(searchInput)).rejects.toThrow("RATE_LIMIT");
    expect(onCall).toHaveBeenCalledWith(expect.objectContaining({
      provider: "Prospeo",
      endpoint: "search-company",
      status: "error",
      error: expect.stringContaining("RATE_LIMIT")
    }));
    expect(JSON.stringify(onCall.mock.calls)).not.toContain("secret-test-key");
  });

  it("searches a company domain for owners and purchasing decision makers", () => {
    expect(buildProspeoPersonSearchPayload(candidate)).toEqual({
      page: 1,
      filters: {
        company: { websites: { include: ["riyadh-medical.example"] } },
        person_job_title: {
          include: [
            "Owner",
            "Founder",
            "CEO",
            "General Manager",
            "Managing Director",
            "Procurement",
            "Purchasing",
            "Sourcing",
            "Product Manager",
            "Category Manager"
          ],
          match_mode: "CONTAINS"
        },
        person_contact_details: { email: ["VERIFIED"] },
        max_person_per_company: 5
      }
    });
  });

  it("enriches the best Prospeo decision maker and returns a verified personal email", async () => {
    const responses = [
      new Response(JSON.stringify({
        error: false,
        results: [{
          person: {
            person_id: "person-1",
            full_name: "Amina Rahman",
            current_job_title: "Owner and Managing Director",
            linkedin_url: "https://www.linkedin.com/in/amina-rahman",
            email: { status: "VERIFIED", revealed: false }
          },
          company: { name: candidate.name, website: candidate.website }
        }]
      }), { status: 200 }),
      new Response(JSON.stringify({
        error: false,
        person: {
          person_id: "person-1",
          full_name: "Amina Rahman",
          current_job_title: "Owner and Managing Director",
          linkedin_url: "https://www.linkedin.com/in/amina-rahman",
          email: { status: "VERIFIED", revealed: true, email: "amina@riyadh-medical.example" }
        },
        company: { name: candidate.name, website: candidate.website }
      }), { status: 200 })
    ];
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      const response = responses.shift();
      if (!response) throw new Error("Unexpected Prospeo request");
      return response;
    });
    const fetchImpl = fetchMock as unknown as typeof fetch;
    const adapter = createProspeoContactAdapter({ apiKey: "test-key", fetchImpl });

    const contacts = await adapter.findContacts(candidate);

    expect(contacts).toEqual([{
      name: "Amina Rahman",
      title: "Owner and Managing Director",
      email: "amina@riyadh-medical.example",
      emailStatus: "valid",
      source: "Prospeo Search Person + Enrich Person",
      sourceUrl: "https://www.linkedin.com/in/amina-rahman",
      isPrimary: true,
      riskNote: undefined
    }]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe("https://api.prospeo.io/enrich-person");
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual({
      only_verified_email: true,
      data: { person_id: "person-1" }
    });
  });
});
