import { buildKeywordSet, yonyeProducts } from "@/lib/products";

type MarketResearchInput = {
  region: string;
  countries: string[];
  productKeys: string[];
  customerTypes: string[];
  extraKeywords: string[];
};

export function buildMarketResearchSummary(input: MarketResearchInput) {
  const keywords = buildKeywordSet(input.productKeys, input.extraKeywords);

  return {
    summary: `Input-derived search strategy for ${input.region}: search ${input.countries.join(", ")} for ${input.customerTypes.join(", ")} using selected product, scenario, customer-type, and customs-related keywords.`,
    keywords,
    buyerConcerns: ["certifications", "factory-direct price", "stable delivery", "OEM/ODM packaging", "factory audit"]
  };
}

export function selectRecommendedProducts(productKeys: string[]): string[] {
  return yonyeProducts
    .filter((product) => productKeys.includes(product.key))
    .map((product) => product.enName);
}
