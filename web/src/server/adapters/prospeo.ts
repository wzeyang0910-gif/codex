import { extractDomain } from "@/lib/dedupe";
import type {
  ContactAdapter,
  CandidateCompany,
  CompanySearchInput,
  FoundContact,
  ProviderCallObserver,
  SearchAdapter
} from "./types";
import { getServerProviderConfig } from "./provider-config";

const PROSPEO_API_BASE = "https://api.prospeo.io";
const COMPANY_KEYWORD_LIMIT = 20;
const COMPANY_SIZE_RANGES = ["11-20", "21-50", "51-100", "101-200", "201-500", "501-1000"];
const DECISION_MAKER_TITLES = [
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
];

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

type ProspeoAdapterOptions = {
  apiKey: string;
  fetchImpl?: FetchLike;
  onCall?: ProviderCallObserver;
};

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as JsonRecord
    : null;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.map(stringValue).filter(Boolean) : [];
}

function withProtocol(value: string): string {
  if (!value) return "";
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

async function prospeoRequest(
  endpoint: string,
  body: unknown,
  options: ProspeoAdapterOptions
): Promise<JsonRecord> {
  const startedAt = Date.now();
  try {
    const response = await (options.fetchImpl ?? fetch)(`${PROSPEO_API_BASE}/${endpoint}`, {
      method: "POST",
      headers: {
        "X-KEY": options.apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });
    const payload = record(await response.json().catch(() => null));

    if (!response.ok || !payload || payload.error === true) {
      const code = stringValue(payload?.error_code) || `HTTP_${response.status}`;
      throw new Error(`Prospeo ${endpoint} failed: ${code}`);
    }

    await reportCall(options.onCall, {
      provider: "Prospeo",
      endpoint,
      status: "success",
      creditsUsed: numericValue(payload.credits_used),
      durationMs: Date.now() - startedAt
    });
    return payload;
  } catch (error) {
    await reportCall(options.onCall, {
      provider: "Prospeo",
      endpoint,
      status: "error",
      creditsUsed: 0,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : "Unknown Prospeo error"
    });
    throw error;
  }
}

function numericValue(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

async function reportCall(observer: ProviderCallObserver | undefined, event: Parameters<ProviderCallObserver>[0]) {
  if (!observer) return;
  try {
    await observer(event);
  } catch {
    // Telemetry must not interrupt lead discovery.
  }
}

export function buildProspeoCompanySearchPayload(input: CompanySearchInput) {
  return {
    page: 1,
    filters: {
      company_location_search: { include: input.countries },
      company_headcount_range: COMPANY_SIZE_RANGES,
      company_attributes: { b2b: true },
      company_keywords: {
        include: input.keywords.slice(0, COMPANY_KEYWORD_LIMIT),
        include_all: false,
        search_everywhere: true
      }
    }
  };
}

function mapProspeoCompany(value: unknown, input: CompanySearchInput): CandidateCompany | null {
  const wrapper = record(value);
  const company = record(wrapper?.company);
  const location = record(company?.location);
  if (!company || !location) return null;

  const name = stringValue(company.name);
  const website = withProtocol(stringValue(company.website) || stringValue(company.domain));
  const country = stringValue(location.country);
  const businessSummary = stringValue(company.description_ai) || stringValue(company.description);
  if (!name || !website || !country || !businessSummary) return null;

  const searchableText = [
    businessSummary,
    stringValue(company.description),
    stringValue(company.industry),
    ...stringList(company.keywords)
  ].join(" ").toLowerCase();
  const demandSignals = input.keywords
    .filter((keyword) => searchableText.includes(keyword.toLowerCase()))
    .slice(0, 5);

  return {
    name,
    country,
    region: input.region,
    city: stringValue(location.city) || undefined,
    website,
    customerType: stringValue(company.industry) || stringValue(company.type) || input.customerTypes.join(", "),
    businessSummary,
    source: "Prospeo Company Search",
    sourceUrl: website,
    demandSignals
  };
}

export function createProspeoSearchAdapter(options: ProspeoAdapterOptions): SearchAdapter {
  return {
    async searchCompanies(input) {
      const payload = await prospeoRequest("search-company", buildProspeoCompanySearchPayload(input), options);
      const results = Array.isArray(payload.results) ? payload.results : [];
      return results
        .map((value) => mapProspeoCompany(value, input))
        .filter((value): value is CandidateCompany => value !== null);
    }
  };
}

export function buildProspeoPersonSearchPayload(company: CandidateCompany) {
  const domain = extractDomain(company.website);
  if (!domain) throw new Error("Prospeo person search requires a company domain.");

  return {
    page: 1,
    filters: {
      company: { websites: { include: [domain] } },
      person_job_title: {
        include: DECISION_MAKER_TITLES,
        match_mode: "CONTAINS"
      },
      person_contact_details: { email: ["VERIFIED"] },
      max_person_per_company: 5
    }
  };
}

function titlePriority(value: unknown): number {
  const person = record(record(value)?.person);
  const title = stringValue(person?.current_job_title).toLowerCase();
  if (/owner|founder|chief executive|\bceo\b/.test(title)) return 1;
  if (/general manager|managing director/.test(title)) return 2;
  if (/procurement|purchasing|sourcing|product manager|category manager/.test(title)) return 3;
  return 4;
}

function mapEnrichedContact(payload: JsonRecord, company: CandidateCompany, isPrimary: boolean): FoundContact | null {
  const person = record(payload.person) ?? record(record(payload.response)?.person);
  if (!person) return null;
  const emailData = record(person.email);
  const email = stringValue(emailData?.email);
  const emailStatus = stringValue(emailData?.status).toUpperCase();
  const name = stringValue(person.full_name);
  const title = stringValue(person.current_job_title);
  if (!name || !title || !email) return null;

  const status = emailStatus === "VERIFIED"
    ? "valid"
    : emailStatus === "ACCEPT_ALL"
      ? "accept_all"
      : "unknown";
  const linkedinUrl = stringValue(person.linkedin_url);

  return {
    name,
    title,
    email,
    emailStatus: status,
    source: "Prospeo Search Person + Enrich Person",
    sourceUrl: linkedinUrl || company.sourceUrl,
    isPrimary,
    riskNote: status === "accept_all" ? "accept-all domain, confirm before outreach" : undefined
  };
}

export function createProspeoContactAdapter(options: ProspeoAdapterOptions): ContactAdapter {
  return {
    async findContacts(company) {
      const payload = await prospeoRequest("search-person", buildProspeoPersonSearchPayload(company), options);
      const results = (Array.isArray(payload.results) ? payload.results : [])
        .filter((value) => stringValue(record(record(value)?.person)?.person_id))
        .sort((left, right) => titlePriority(left) - titlePriority(right))
        .slice(0, 3);
      const contacts: FoundContact[] = [];

      for (const result of results) {
        const person = record(record(result)?.person);
        const personId = stringValue(person?.person_id);
        const enriched = await prospeoRequest("enrich-person", {
          only_verified_email: true,
          data: { person_id: personId }
        }, options);
        const contact = mapEnrichedContact(enriched, company, contacts.length === 0);
        if (contact) contacts.push(contact);
      }

      return contacts;
    }
  };
}

export function getProspeoConfig() {
  return getServerProviderConfig("PROSPEO_API_KEY");
}
