import type {
  AdapterSet,
  CandidateCompany,
  CompanySearchInput,
  FoundContact
} from "./types";

const mockCompanies: CandidateCompany[] = [
  {
    name: "Arabian Medical Supplies Co.",
    country: "Saudi Arabia",
    region: "Middle East",
    city: "Riyadh",
    website: "https://arabian-medical.example",
    customerType: "distributor",
    businessSummary: "distributes wound care, orthopedic and rehabilitation supplies in Saudi Arabia",
    source: "Mock industry directory",
    sourceUrl: "https://example.com/arabian-medical",
    demandSignals: ["wound care catalog", "orthopedic supplies", "imports medical consumables"]
  },
  {
    name: "Gulf Sports Medicine Trading",
    country: "Saudi Arabia",
    region: "Middle East",
    city: "Jeddah",
    website: "https://gulf-sports-med.example",
    customerType: "sports medicine distributor",
    businessSummary: "supplies physiotherapy clinics and sports medicine retailers",
    source: "Mock search result",
    sourceUrl: "https://example.com/gulf-sports-med",
    demandSignals: ["kinesiology tape product page", "physiotherapy channel"]
  },
  {
    name: "Riyadh First Aid Wholesale",
    country: "Saudi Arabia",
    region: "Middle East",
    city: "Riyadh",
    website: "https://riyadh-first-aid.example",
    customerType: "wholesaler",
    businessSummary: "wholesales first aid kits, bandages and wound plasters",
    source: "Mock B2B directory",
    sourceUrl: "https://example.com/riyadh-first-aid",
    demandSignals: ["first aid wholesale", "bandage category"]
  },
  {
    name: "Mena Rehab Products",
    country: "United Arab Emirates",
    region: "Middle East",
    city: "Dubai",
    website: "https://mena-rehab.example",
    customerType: "rehabilitation supplier",
    businessSummary: "serves rehabilitation centers with tapes, braces and therapy supplies",
    source: "Mock social page",
    sourceUrl: "https://example.com/mena-rehab",
    demandSignals: ["rehabilitation supplier", "sports tape posts"]
  },
  {
    name: "Jeddah Pharmacy Supply Network",
    country: "Saudi Arabia",
    region: "Middle East",
    city: "Jeddah",
    website: "https://jeddah-pharmacy.example",
    customerType: "pharmacy supplier",
    businessSummary: "supplies pharmacies with wound care and personal care consumables",
    source: "Mock company database",
    sourceUrl: "https://example.com/jeddah-pharmacy",
    demandSignals: ["pharmacy supply", "wound plaster category", "acne patch category"]
  },
  {
    name: "Dammam Medical Distribution Co.",
    country: "Saudi Arabia",
    region: "Middle East",
    city: "Dammam",
    website: "https://dammam-medical.example",
    customerType: "medical distributor",
    businessSummary: "distributes hospital consumables, wound care products and rehabilitation supplies across the Eastern Province",
    source: "Mock medical trade directory",
    sourceUrl: "https://example.com/dammam-medical-distribution",
    demandSignals: ["medical consumables catalog", "wound care distribution", "rehabilitation supply tenders"]
  }
];

export function createMockAdapterSet(): AdapterSet {
  return {
    search: {
      async searchCompanies(input: CompanySearchInput) {
        return mockCompanies.filter((company) => {
          const countryOk = input.countries.length === 0 || input.countries.includes(company.country);
          const keywordText = `${company.businessSummary} ${company.demandSignals.join(" ")}`.toLowerCase();
          const keywordOk = input.keywords.some((keyword) =>
            keywordText.includes(keyword.toLowerCase().split(" ")[0])
          );
          return countryOk || keywordOk;
        });
      }
    },
    contacts: {
      async findContacts(company: CandidateCompany): Promise<FoundContact[]> {
        const domain = company.website?.replace(/^https?:\/\//, "") ?? "example.com";
        const isDammamMedical = company.name === "Dammam Medical Distribution Co.";

        return [
          {
            name: isDammamMedical
              ? "Noura Al-Harbi"
              : company.name.includes("Sports")
                ? "Omar Hassan"
                : "Ahmed Saleh",
            title: isDammamMedical
              ? "Procurement Director"
              : company.name.includes("Sports")
                ? "Managing Director"
                : "General Manager",
            email: isDammamMedical
              ? `noura.alharbi@${domain}`
              : company.name.includes("Pharmacy")
              ? `fatima.almutairi@${domain}`
              : company.name.includes("Sports")
                ? `omar.hassan@${domain}`
                : `ahmed.saleh@${domain}`,
            emailStatus: company.name.includes("Pharmacy") ? "accept_all" : "valid",
            source: "Mock Prospeo + Hunter verification",
            sourceUrl: company.sourceUrl,
            isPrimary: true,
            riskNote: company.name.includes("Pharmacy")
              ? "accept-all domain, confirm before outreach"
              : undefined
          }
        ];
      }
    }
  };
}

export function createAdapterSet(): AdapterSet {
  return createMockAdapterSet();
}
