import type { EmailStatus } from "@prisma/client";

export type CompanySearchInput = {
  region: string;
  countries: string[];
  keywords: string[];
  customerTypes: string[];
};

export type CandidateCompany = {
  name: string;
  country: string;
  region: string;
  city?: string;
  website?: string;
  customerType: string;
  businessSummary: string;
  source: string;
  sourceUrl: string;
  demandSignals: string[];
};

export type FoundContact = {
  name: string;
  title: string;
  email: string;
  emailStatus: EmailStatus;
  source: string;
  sourceUrl?: string;
  isPrimary: boolean;
  riskNote?: string;
};

export type SearchAdapter = {
  searchCompanies(input: CompanySearchInput): Promise<CandidateCompany[]>;
};

export type ContactAdapter = {
  findContacts(company: CandidateCompany): Promise<FoundContact[]>;
};

export type AdapterSet = {
  search: SearchAdapter;
  contacts: ContactAdapter;
};

export type LeadDataAdapter = AdapterSet;
