import { describe, expect, it } from "vitest";
import { extractDomain, normalizeCompanyName } from "@/lib/dedupe";

describe("company dedupe", () => {
  it("normalizes company suffix and punctuation", () => {
    expect(normalizeCompanyName("Alpha Medical Trading Co., Ltd.")).toBe("alpha medical");
  });

  it("removes Japanese legal-form prefixes", () => {
    expect(normalizeCompanyName("株式会社アルファ")).toBe("アルファ");
    expect(normalizeCompanyName("有限会社ベータ")).toBe("ベータ");
  });

  it("keeps meaningful non-Latin company text", () => {
    expect(normalizeCompanyName("常州康民医疗用品有限公司")).toContain("康民医疗用品");
  });

  it("preserves meaningful CJK medical device industry words", () => {
    const normalized = normalizeCompanyName("原研医疗器械（常州）有限公司");

    expect(normalized).toContain("原研医疗器械");
    expect(normalized).toBe("原研医疗器械 常州");
  });

  it("extracts comparable website domain", () => {
    expect(extractDomain("https://www.example.com/products")).toBe("example.com");
  });
});
