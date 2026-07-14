import { describe, expect, it, vi } from "vitest";
import { createHunterContactAdapter } from "@/server/adapters/hunter";
import type { CandidateCompany } from "@/server/adapters/types";

const candidate: CandidateCompany = {
  name: "Riyadh Medical Trading",
  country: "Saudi Arabia",
  region: "Middle East",
  city: "Riyadh",
  website: "https://www.riyadh-medical.example/products",
  customerType: "medical distributor",
  businessSummary: "Distributes wound care and rehabilitation products.",
  source: "Prospeo Company Search",
  sourceUrl: "https://www.riyadh-medical.example",
  demandSignals: ["wound care catalog"]
};

describe("Hunter live contact adapter", () => {
  it("returns verified named decision makers with owners first", async () => {
    const onCall = vi.fn();
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({
      data: {
        domain: "riyadh-medical.example",
        organization: candidate.name,
        emails: [
          {
            value: "buyer@riyadh-medical.example",
            type: "personal",
            first_name: "Fahad",
            last_name: "Al-Salem",
            position: "Procurement Manager",
            verification: { status: "valid" },
            sources: [{ uri: "https://riyadh-medical.example/team/fahad" }]
          },
          {
            value: "amina@riyadh-medical.example",
            type: "personal",
            first_name: "Amina",
            last_name: "Rahman",
            position: "Founder and CEO",
            verification: { status: "valid" },
            sources: [{ uri: "https://riyadh-medical.example/about" }]
          },
          {
            value: "info@riyadh-medical.example",
            type: "generic",
            first_name: null,
            last_name: null,
            position: null,
            verification: { status: "valid" },
            sources: []
          },
          {
            value: "sales@riyadh-medical.example",
            type: "personal",
            first_name: "Saleh",
            last_name: "Ali",
            position: "Sales Manager",
            verification: { status: "valid" },
            sources: []
          },
          {
            value: "director@riyadh-medical.example",
            type: "personal",
            first_name: "Noura",
            last_name: "Hassan",
            position: "Managing Director",
            verification: { status: "accept_all" },
            sources: []
          }
        ]
      }
    }), { status: 200 }));
    const fetchImpl = fetchMock as unknown as typeof fetch;
    const adapter = createHunterContactAdapter({ apiKey: "hunter-test-key", fetchImpl, onCall });

    const contacts = await adapter.findContacts(candidate);

    expect(contacts).toEqual([
      {
        name: "Amina Rahman",
        title: "Founder and CEO",
        email: "amina@riyadh-medical.example",
        emailStatus: "valid",
        source: "Hunter Domain Search",
        sourceUrl: "https://riyadh-medical.example/about",
        isPrimary: true,
        riskNote: undefined
      },
      {
        name: "Fahad Al-Salem",
        title: "Procurement Manager",
        email: "buyer@riyadh-medical.example",
        emailStatus: "valid",
        source: "Hunter Domain Search",
        sourceUrl: "https://riyadh-medical.example/team/fahad",
        isPrimary: false,
        riskNote: undefined
      }
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const requestedUrl = new URL(String(fetchMock.mock.calls[0][0]));
    expect(requestedUrl.origin + requestedUrl.pathname).toBe("https://api.hunter.io/v2/domain-search");
    expect(requestedUrl.searchParams.get("domain")).toBe("riyadh-medical.example");
    expect(requestedUrl.searchParams.get("api_key")).toBe("hunter-test-key");
    expect(requestedUrl.searchParams.get("limit")).toBe("10");
    expect(onCall).toHaveBeenCalledWith(expect.objectContaining({
      provider: "Hunter",
      endpoint: "domain-search",
      status: "success",
      creditsUsed: 0,
      durationMs: expect.any(Number)
    }));
  });

  it("returns no contacts when the company has no usable domain", async () => {
    const fetchImpl = vi.fn() as typeof fetch;
    const adapter = createHunterContactAdapter({ apiKey: "hunter-test-key", fetchImpl });

    const contacts = await adapter.findContacts({ ...candidate, website: undefined });

    expect(contacts).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
