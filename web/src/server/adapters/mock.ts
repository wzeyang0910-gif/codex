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
    customerType: "medical distributor",
    businessSummary: "medical distributor of wound care, orthopedic and rehabilitation supplies in Saudi Arabia",
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
    customerType: "first aid distributor",
    businessSummary: "medical distributor of first aid kits, bandages and wound plasters",
    source: "Mock B2B directory",
    sourceUrl: "https://example.com/riyadh-first-aid",
    demandSignals: ["first aid wholesale", "kinesiology tape and bandage category"]
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
    customerType: "pharmacy distributor",
    businessSummary: "medical distributor supplying pharmacies with wound care and personal care consumables",
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
    businessSummary: "medical distributor of hospital consumables, wound care products and rehabilitation supplies across the Eastern Province",
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
          const regionOk = !normalize(input.region) || normalize(company.region) === normalize(input.region);
          const countryOk =
            input.countries.length === 0 ||
            input.countries.some((country) => normalize(country) === normalize(company.country));
          const customerTypeOk =
            input.customerTypes.length === 0 ||
            input.customerTypes.some((customerType) =>
              normalize(company.customerType).includes(normalize(customerType))
            );
          const searchableFields = [company.businessSummary, company.customerType, ...company.demandSignals];
          const keywordOk =
            input.keywords.length === 0 ||
            input.keywords.some((keyword) =>
              searchableFields.some((field) => normalize(field).includes(normalize(keyword)))
            );

          return regionOk && countryOk && customerTypeOk && keywordOk;
        });
      }
    },
    contacts: {
      async findContacts(company: CandidateCompany): Promise<FoundContact[]> {
        const domain = company.website?.replace(/^https?:\/\//, "") ?? "example.com";
        const isDammamMedical = company.name === "Dammam Medical Distribution Co.";
        const isPharmacy = company.name.includes("Pharmacy");

        return [
          {
            name: isDammamMedical
              ? "Noura Al-Harbi"
              : isPharmacy
                ? "Fatima Almutairi"
              : company.name.includes("Sports")
                ? "Omar Hassan"
                : "Ahmed Saleh",
            title: isDammamMedical
              ? "Procurement Director"
              : isPharmacy
                ? "Procurement Manager"
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
            emailStatus: isPharmacy ? "accept_all" : "valid",
            source: "Mock Prospeo + Hunter verification",
            sourceUrl: company.sourceUrl,
            isPrimary: true,
            riskNote: isPharmacy
              ? "accept-all domain, confirm before outreach"
              : undefined
          }
        ];
      }
    }
  };
}

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function createAdapterSet(): AdapterSet {
  return createMockAdapterSet();
}
