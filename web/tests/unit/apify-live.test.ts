import { describe, expect, it, vi } from "vitest";
import { buildApifyPlacesInput, createApifySearchAdapter } from "@/server/adapters/apify";
import type { CompanySearchInput } from "@/server/adapters/types";

const input: CompanySearchInput = {
  region: "Middle East",
  countries: ["Saudi Arabia"],
  keywords: ["medical tape", "wound care", "kinesiology tape", "cohesive bandage", "extra keyword"],
  customerTypes: ["medical distributor", "sports medicine supplier"]
};

describe("Apify Google Places search adapter", () => {
  it("builds bounded product and customer-type search combinations", () => {
    expect(buildApifyPlacesInput(input)).toEqual({
      searchStringsArray: [
        "medical tape medical distributor",
        "wound care medical distributor",
        "kinesiology tape medical distributor",
        "cohesive bandage medical distributor",
        "medical tape sports medicine supplier",
        "wound care sports medicine supplier",
        "kinesiology tape sports medicine supplier",
        "cohesive bandage sports medicine supplier"
      ],
      locationQuery: "Saudi Arabia",
      maxCrawledPlacesPerSearch: 10,
      language: "en",
      skipClosedPlaces: true
    });
  });

  it("maps traceable Google Places businesses into candidate companies", async () => {
    const onCall = vi.fn();
    const fetchMock = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) =>
      new Response(JSON.stringify([{
        title: "Riyadh Medical Trading",
        website: "https://riyadh-medical.example",
        categoryName: "Medical supply store",
        categories: ["Medical equipment supplier", "Wound care supplier"],
        description: "Distributor of medical tape and wound care products.",
        city: "Riyadh",
        countryCode: "SA",
        url: "https://www.google.com/maps/place/riyadh-medical"
      }]), { status: 200 })
    );
    const adapter = createApifySearchAdapter({
      apiKey: "apify-test-key",
      fetchImpl: fetchMock as unknown as typeof fetch,
      onCall
    });

    const companies = await adapter.searchCompanies(input);

    expect(companies).toEqual([{
      name: "Riyadh Medical Trading",
      country: "Saudi Arabia",
      region: "Middle East",
      city: "Riyadh",
      website: "https://riyadh-medical.example",
      customerType: "Medical supply store",
      businessSummary: "Distributor of medical tape and wound care products.",
      source: "Apify Google Places",
      sourceUrl: "https://www.google.com/maps/place/riyadh-medical",
      demandSignals: ["medical tape", "wound care"]
    }]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/acts/compass~crawler-google-places/run-sync-get-dataset-items");
    expect(new URL(String(url)).searchParams.get("token")).toBe("apify-test-key");
    expect(init?.method).toBe("POST");
    expect(onCall).toHaveBeenCalledWith(expect.objectContaining({
      provider: "Apify",
      endpoint: "compass~crawler-google-places",
      status: "success"
    }));
  });

  it("drops places without a company website", async () => {
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) =>
      new Response(JSON.stringify([{ title: "No Website Store", url: "https://maps.example/place" }]), { status: 200 })
    ) as unknown as typeof fetch;
    const adapter = createApifySearchAdapter({ apiKey: "apify-test-key", fetchImpl });

    await expect(adapter.searchCompanies(input)).resolves.toEqual([]);
  });
});
