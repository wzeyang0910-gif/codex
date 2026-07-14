import { extractDomain, normalizeCompanyName } from "@/lib/dedupe";
import { createApifySearchAdapter } from "./apify";
import { createHunterContactAdapter } from "./hunter";
import { createMockAdapterSet } from "./mock";
import { createProspeoContactAdapter, createProspeoSearchAdapter } from "./prospeo";
import type {
  AdapterSet,
  CandidateCompany,
  ContactAdapter,
  FoundContact,
  ProviderCallObserver,
  SearchAdapter
} from "./types";

type Environment = Record<string, string | undefined>;

type ConfiguredAdapterOptions = {
  environment?: Environment;
  onCall?: ProviderCallObserver;
  mockFactory?: () => AdapterSet;
  apifySearchFactory?: (options: { apiKey: string; onCall?: ProviderCallObserver }) => SearchAdapter;
  prospeoSearchFactory?: (options: { apiKey: string; onCall?: ProviderCallObserver }) => SearchAdapter;
  prospeoContactFactory?: (options: { apiKey: string; onCall?: ProviderCallObserver }) => ContactAdapter;
  hunterContactFactory?: (options: { apiKey: string; onCall?: ProviderCallObserver }) => ContactAdapter;
};

function mergeContacts(results: PromiseSettledResult<FoundContact[]>[]): FoundContact[] {
  const contacts = new Map<string, FoundContact>();

  for (const result of results) {
    if (result.status !== "fulfilled") continue;
    for (const contact of result.value) {
      const key = contact.email.trim().toLowerCase();
      if (!key || contacts.has(key)) continue;
      contacts.set(key, contact);
    }
  }

  return [...contacts.values()].map((contact, index) => ({
    ...contact,
    isPrimary: index === 0
  }));
}

function combineContactAdapters(adapters: ContactAdapter[]): ContactAdapter {
  return {
    async findContacts(company) {
      return mergeContacts(await Promise.allSettled(
        adapters.map((adapter) => adapter.findContacts(company))
      ));
    }
  };
}

function combineSearchAdapters(adapters: SearchAdapter[]): SearchAdapter {
  return {
    async searchCompanies(input) {
      const results = await Promise.allSettled(
        adapters.map((adapter) => adapter.searchCompanies(input))
      );
      const companies = new Map<string, CandidateCompany>();

      for (const result of results) {
        if (result.status !== "fulfilled") continue;
        for (const company of result.value) {
          const identity = extractDomain(company.website)
            || `${normalizeCompanyName(company.name)}:${company.country}:${company.region}`;
          if (!identity || companies.has(identity)) continue;
          companies.set(identity, company);
        }
      }

      return [...companies.values()];
    }
  };
}

export function createConfiguredAdapterSet(options: ConfiguredAdapterOptions = {}): AdapterSet {
  const environment = options.environment ?? process.env;
  const useMockAdapters = environment.USE_MOCK_ADAPTERS !== "false";

  if (useMockAdapters) {
    return (options.mockFactory ?? createMockAdapterSet)();
  }

  const searchAdapters: SearchAdapter[] = [];
  const contactAdapters: ContactAdapter[] = [];
  const prospeoApiKey = environment.PROSPEO_API_KEY?.trim() ?? "";
  const prospeoSearchFactory = options.prospeoSearchFactory ?? createProspeoSearchAdapter;
  const prospeoContactFactory = options.prospeoContactFactory ?? createProspeoContactAdapter;
  if (prospeoApiKey) {
    searchAdapters.push(prospeoSearchFactory({ apiKey: prospeoApiKey, onCall: options.onCall }));
    contactAdapters.push(prospeoContactFactory({ apiKey: prospeoApiKey, onCall: options.onCall }));
  }

  const apifyApiKey = environment.APIFY_API_KEY?.trim() ?? "";
  if (apifyApiKey) {
    const apifySearchFactory = options.apifySearchFactory ?? createApifySearchAdapter;
    searchAdapters.push(apifySearchFactory({ apiKey: apifyApiKey, onCall: options.onCall }));
  }

  const hunterApiKey = environment.HUNTER_API_KEY?.trim() ?? "";

  if (hunterApiKey) {
    const hunterContactFactory = options.hunterContactFactory ?? createHunterContactAdapter;
    contactAdapters.push(hunterContactFactory({ apiKey: hunterApiKey, onCall: options.onCall }));
  }

  if (searchAdapters.length === 0) {
    throw new Error("At least one live company search provider is required");
  }
  if (contactAdapters.length === 0) {
    throw new Error("At least one live contact provider is required");
  }

  return {
    search: combineSearchAdapters(searchAdapters),
    contacts: combineContactAdapters(contactAdapters)
  };
}

export const createAdapterSet = createConfiguredAdapterSet;
