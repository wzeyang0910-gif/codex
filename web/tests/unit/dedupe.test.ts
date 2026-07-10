import { describe, expect, it } from "vitest";
import { extractDomain, normalizeCompanyName } from "@/lib/dedupe";

describe("company dedupe", () => {
  it("normalizes company suffix and punctuation", () => {
    expect(normalizeCompanyName("Alpha Medical Trading Co., Ltd.")).toBe("alpha medical");
  });

  it("keeps meaningful non-Latin company text", () => {
    expect(normalizeCompanyName("鍘熺爺鍖荤枟鍣ㄦ锛堝父宸烇級鏈夐檺鍏徃")).toContain("鍘熺爺鍖荤枟鍣ㄦ");
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
