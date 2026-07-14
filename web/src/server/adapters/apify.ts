import { getServerProviderConfig } from "./provider-config";
import type {
  CandidateCompany,
  CompanySearchInput,
  ProviderCallObserver,
  SearchAdapter
} from "./types";

const APIFY_API_BASE = "https://api.apify.com/v2";
const DEFAULT_ACTOR_ID = "compass~crawler-google-places";
const KEYWORD_LIMIT = 4;
const CUSTOMER_TYPE_LIMIT = 2;

type ApifySearchAdapterOptions = {
  apiKey: string;
  actorId?: string;
  fetchImpl?: typeof fetch;
  onCall?: ProviderCallObserver;
};

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as JsonRecord
    : null;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function textList(value: unknown): string[] {
  return Array.isArray(value) ? value.map(text).filter(Boolean) : [];
}

export function buildApifyPlacesInput(input: CompanySearchInput) {
  const keywords = input.keywords.slice(0, KEYWORD_LIMIT);
  const customerTypes = input.customerTypes.slice(0, CUSTOMER_TYPE_LIMIT);
  const searchStringsArray = customerTypes.length > 0
    ? customerTypes.flatMap((customerType) => keywords.map((keyword) => `${keyword} ${customerType}`))
    : keywords;

  return {
    searchStringsArray,
    locationQuery: input.countries.join(", ") || input.region,
    maxCrawledPlacesPerSearch: 10,
    language: "en",
    skipClosedPlaces: true
  };
}

function mapPlace(value: unknown, input: CompanySearchInput): CandidateCompany | null {
  const place = record(value);
  if (!place) return null;
  const name = text(place.title) || text(place.name);
  const website = text(place.website);
  const country = text(place.country) || input.countries[0] || "";
  const sourceUrl = text(place.url) || text(place.placeUrl);
  const category = text(place.categoryName) || textList(place.categories)[0] || input.customerTypes[0] || "";
  const summary = text(place.description) || [category, ...textList(place.categories)].filter(Boolean).join(", ");
  if (!name || !website || !country || !sourceUrl || !summary) return null;

  const searchableText = [summary, category, ...textList(place.categories)].join(" ").toLowerCase();
  const demandSignals = input.keywords
    .filter((keyword) => searchableText.includes(keyword.toLowerCase()))
    .slice(0, 5);

  return {
    name,
    country,
    region: input.region,
    city: text(place.city) || undefined,
    website,
    customerType: category,
    businessSummary: summary,
    source: "Apify Google Places",
    sourceUrl,
    demandSignals
  };
}

async function reportCall(observer: ProviderCallObserver | undefined, event: Parameters<ProviderCallObserver>[0]) {
  if (!observer) return;
  try {
    await observer(event);
  } catch {
    // Telemetry must not interrupt lead discovery.
  }
}

export function createApifySearchAdapter({
  apiKey,
  actorId = DEFAULT_ACTOR_ID,
  fetchImpl = fetch,
  onCall
}: ApifySearchAdapterOptions): SearchAdapter {
  return {
    async searchCompanies(input) {
      const endpoint = actorId;
      const url = new URL(`${APIFY_API_BASE}/acts/${encodeURIComponent(actorId)}/run-sync-get-dataset-items`);
      url.searchParams.set("token", apiKey);
      url.searchParams.set("clean", "true");
      const startedAt = Date.now();

      try {
        const response = await fetchImpl(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildApifyPlacesInput(input))
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !Array.isArray(payload)) {
          throw new Error(`Apify ${actorId} failed with status ${response.status}`);
        }

        await reportCall(onCall, {
          provider: "Apify",
          endpoint,
          status: "success",
          creditsUsed: 0,
          durationMs: Date.now() - startedAt
        });
        return payload
          .map((place) => mapPlace(place, input))
          .filter((place): place is CandidateCompany => place !== null);
      } catch (error) {
        await reportCall(onCall, {
          provider: "Apify",
          endpoint,
          status: "error",
          creditsUsed: 0,
          durationMs: Date.now() - startedAt,
          error: error instanceof Error ? error.message : "Unknown Apify error"
        });
        throw error;
      }
    }
  };
}

export function getApifyConfig() {
  return getServerProviderConfig("APIFY_API_KEY");
}
