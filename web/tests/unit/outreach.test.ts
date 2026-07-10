import { describe, expect, it } from "vitest";
import { buildOutreachLetter } from "@/lib/outreach";

describe("outreach letter generation", () => {
  it("mentions customer-specific business and Yonye factory strengths", () => {
    const letter = buildOutreachLetter({
      companyName: "Alpha Medical",
      businessSummary: "distributes wound care and sports medicine products in Saudi Arabia",
      recommendedProducts: ["kinesiology tape", "cohesive bandage"],
      contactName: "Mr. Ahmed",
      language: "English"
    });

    expect(letter.subject).toContain("Alpha Medical");
    expect(letter.body).toContain("distributes wound care and sports medicine products");
    expect(letter.body).toContain("Changzhou, China");
    expect(letter.body).toContain("ISO13485, CE and FDA");
    expect(letter.body).toContain("factory audit");
    expect(letter.body).toContain("PDF catalog");
  });
});
