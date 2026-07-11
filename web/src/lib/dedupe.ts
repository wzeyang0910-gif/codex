const ENGLISH_SUFFIXES = new Set([
  "co",
  "company",
  "corp",
  "corporation",
  "inc",
  "incorporated",
  "ltd",
  "limited",
  "llc",
  "llp",
  "plc",
  "trading"
]);

const CJK_LEGAL_SUFFIX_PATTERN = /(株式会社|有限会社|股份有限公司|有限责任公司|有限公司|公司|会社)$/gu;

const CJK_LEGAL_PREFIX_PATTERN = /^(株式会社|有限会社)/u;

export function normalizeCompanyName(name: string): string {
  const normalized = name
    .toLowerCase()
    .replace(CJK_LEGAL_PREFIX_PATTERN, "")
    .replace(CJK_LEGAL_SUFFIX_PATTERN, "")
    .replace(/[^\p{L}\p{N}\uE000-\uF8FF]+/gu, " ")
    .trim();

  const tokens = normalized
    .split(/\s+/)
    .filter((token) => token && !ENGLISH_SUFFIXES.has(token));

  return tokens.join(" ").replace(CJK_LEGAL_PREFIX_PATTERN, "").replace(CJK_LEGAL_SUFFIX_PATTERN, "").trim();
}

export function extractDomain(url?: string | null): string | null {
  const value = url?.trim();

  if (!value) {
    return null;
  }

  try {
    const parsed = new URL(value.includes("://") ? value : `https://${value}`);
    const hostname = parsed.hostname.toLowerCase().replace(/^www\./, "");

    return hostname.includes(".") ? hostname : null;
  } catch {
    return null;
  }
}
