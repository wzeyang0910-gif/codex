import { describe, expect, it } from "vitest";
import { buildKeywordSet, yonyeProducts } from "@/lib/products";

describe("Yonye product knowledge", () => {
  it("includes medical, sports, wound, and orthopedic search language", () => {
    const keywords = buildKeywordSet(["kinesiology_tape", "pop_bandage"], ["Saudi importer"]);

    expect(keywords).toContain("kinesiology tape");
    expect(keywords).toContain("sports medicine");
    expect(keywords).toContain("plaster bandage");
    expect(keywords).toContain("orthopedic supplier");
    expect(keywords).toContain("Saudi importer");
  });

  it("seeds the main Yonye product families", () => {
    const keys = yonyeProducts.map((product) => product.key);

    expect(keys).toContain("surgical_tape");
    expect(keys).toContain("cohesive_bandage");
    expect(keys).toContain("wound_plaster");
    expect(keys).toContain("acne_patch");
  });
});
