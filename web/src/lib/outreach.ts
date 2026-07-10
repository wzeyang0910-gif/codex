export type OutreachInput = {
  companyName: string;
  businessSummary: string;
  recommendedProducts: string[];
  contactName?: string;
  language?: string;
};

function wantsSimplifiedChinese(language?: string): boolean {
  const normalized = language?.trim().toLowerCase();

  if (!normalized) {
    return false;
  }

  return ["chinese", "simplified chinese", "simplified", "中文", "简体中文", "简体", "汉语", "zh-cn", "zh_cn"].some(
    (value) => normalized.includes(value)
  );
}

export function buildOutreachLetter(input: OutreachInput): { subject: string; body: string } {
  const companyName = input.companyName.trim();
  const businessSummary = input.businessSummary.trim();
  const products = input.recommendedProducts.map((product) => product.trim()).filter(Boolean);
  const productText = products.length > 0 ? products.join(", ") : "medical tape and adhesive products";
  const language = input.language?.trim() || "English";

  if (wantsSimplifiedChinese(language)) {
    const chineseProductText = products.length > 0 ? products.join("、") : "医用胶带及粘性医用产品";
    const greeting = input.contactName?.trim() ? `${input.contactName.trim()}，您好：` : "采购团队，您好：";
    const subject = `${companyName} - 原研医用胶带工厂合作建议`;
    const body = [
      greeting,
      "",
      `了解到${companyName}${businessSummary}。结合贵司业务方向，我们认为${chineseProductText}可能适合贵司后续采购、渠道销售或自有品牌产品规划。`,
      "",
      "原研医疗器械（常州）有限公司（Yonye Medical Instrument (Changzhou) Co., Ltd.）是位于中国常州的医用胶带和粘性医用产品生产工厂，可为经销商、进口商和医疗用品品牌提供 OEM/ODM 包装、稳定质量控制、具有竞争力的工厂直供价格以及灵活交付支持。",
      "",
      "我司具备 ISO13485、CE 和 FDA 相关资质，可配合贵司进行验厂、工厂参观或生产流程审核，帮助采购团队完成供应商评估。我们也可以根据推荐产品提供规格、包装方案、样品和报价信息。",
      "",
      "随信附上 PDF目录，便于贵司初步了解。如贵司正在评估相关产品供应商，期待进一步沟通。",
      "",
      "顺祝商祺，",
      "原研医疗器械（常州）有限公司"
    ].join("\n");

    return { subject, body };
  }

  const greeting = input.contactName?.trim() ? `Dear ${input.contactName.trim()},` : "Dear Purchasing Team,";
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
