export type OutreachInput = {
  companyName: string;
  businessSummary: string;
  recommendedProducts: string[];
  contactName?: string;
  language?: string;
};

export function buildOutreachLetter(input: OutreachInput): { subject: string; body: string } {
  const companyName = input.companyName.trim();
  const businessSummary = input.businessSummary.trim();
  const products = input.recommendedProducts.map((product) => product.trim()).filter(Boolean);
  const productText = products.length > 0 ? products.join(", ") : "medical tape and adhesive products";
  const greeting = input.contactName?.trim() ? `Dear ${input.contactName.trim()},` : "Dear Purchasing Team,";
  const language = input.language?.trim() || "English";

  const subject = `${companyName} - Yonye factory support for ${productText}`;
  const body = [
    greeting,
    "",
    `I noticed that ${companyName} ${businessSummary}. Based on that focus, I thought ${productText} may be relevant for your current sourcing or private-label product plans.`,
    "",
    "Yonye Medical Instrument (Changzhou) Co., Ltd. is a medical tape and adhesive medical product manufacturer/factory in Changzhou, China. We support OEM/ODM packaging, stable quality control, competitive factory-direct pricing, and flexible delivery for distributors, importers, and healthcare product brands.",
    "",
    "Our factory has ISO13485, CE and FDA-related qualifications, and we can support a factory audit, factory visit, or production process review when your team needs supplier verification. I can also share product specifications, packaging options, samples, and quotation details for the recommended items.",
    "",
    `Please find our attached PDF catalog for an initial review. If ${language} is preferred for future communication, we can prepare follow-up materials in that language.`,
    "",
    "Best regards,",
    "Yonye Medical Instrument (Changzhou) Co., Ltd."
  ].join("\n");

  return { subject, body };
}
