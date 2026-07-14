import { extractDomain } from "@/lib/dedupe";
import { getServerProviderConfig } from "./provider-config";
import type { CandidateCompany, ContactAdapter, FoundContact, ProviderCallObserver } from "./types";

const HUNTER_DOMAIN_SEARCH_URL = "https://api.hunter.io/v2/domain-search";
const DECISION_MAKER_TITLE = /\b(owner|founder|chief executive|ceo|general manager|managing director|procurement|purchasing|sourcing|product manager|category manager)\b/i;

type HunterContactAdapterOptions = {
  apiKey: string;
  fetchImpl?: typeof fetch;
  onCall?: ProviderCallObserver;
};

type HunterEmail = {
  value?: unknown;
  type?: unknown;
  first_name?: unknown;
  last_name?: unknown;
  position?: unknown;
  verification?: { status?: unknown };
  sources?: { uri?: unknown }[];
};

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function titlePriority(title: string): number {
  if (/\b(owner|founder|chief executive|ceo)\b/i.test(title)) return 0;
  if (/\b(general manager|managing director)\b/i.test(title)) return 1;
  if (/\b(procurement|purchasing|sourcing|product manager|category manager)\b/i.test(title)) return 2;
  return 9;
}

function mapHunterEmail(email: HunterEmail, company: CandidateCompany): FoundContact | null {
  const firstName = text(email.first_name);
  const lastName = text(email.last_name);
  const name = `${firstName} ${lastName}`.trim();
  const title = text(email.position);
  const address = text(email.value).toLowerCase();
  const status = text(email.verification?.status).toLowerCase();
  const sourceUrl = email.sources?.map((source) => text(source.uri)).find(Boolean) ?? company.sourceUrl;

  if (text(email.type).toLowerCase() !== "personal") return null;
  if (!name || !title || !address || !address.includes("@")) return null;
  if (!DECISION_MAKER_TITLE.test(title) || status !== "valid") return null;

  return {
    name,
    title,
    email: address,
    emailStatus: "valid",
    source: "Hunter Domain Search",
    sourceUrl,
    isPrimary: false,
    riskNote: undefined
  };
}

export function createHunterContactAdapter({
  apiKey,
  fetchImpl = fetch,
  onCall
}: HunterContactAdapterOptions): ContactAdapter {
  return {
    async findContacts(company) {
      const domain = extractDomain(company.website);
      if (!domain) return [];

      const url = new URL(HUNTER_DOMAIN_SEARCH_URL);
      url.searchParams.set("domain", domain);
      url.searchParams.set("limit", "10");
      url.searchParams.set("api_key", apiKey);

      const startedAt = Date.now();
      try {
        const response = await fetchImpl(url);
        if (!response.ok) {
          throw new Error(`Hunter domain search failed with status ${response.status}`);
        }

        const payload = await response.json() as { data?: { emails?: HunterEmail[] } };
        const contacts = (payload.data?.emails ?? [])
          .map((email) => mapHunterEmail(email, company))
          .filter((contact): contact is FoundContact => contact !== null)
          .sort((left, right) => titlePriority(left.title) - titlePriority(right.title));

        await reportCall(onCall, {
          provider: "Hunter",
          endpoint: "domain-search",
          status: "success",
          creditsUsed: 0,
          durationMs: Date.now() - startedAt
        });
        return contacts.map((contact, index) => ({ ...contact, isPrimary: index === 0 }));
      } catch (error) {
        await reportCall(onCall, {
          provider: "Hunter",
          endpoint: "domain-search",
          status: "error",
          creditsUsed: 0,
          durationMs: Date.now() - startedAt,
          error: error instanceof Error ? error.message : "Unknown Hunter error"
        });
        throw error;
      }
    }
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

export function getHunterConfig() {
  return getServerProviderConfig("HUNTER_API_KEY");
}
