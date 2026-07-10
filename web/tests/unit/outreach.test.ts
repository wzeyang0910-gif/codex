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

  it("writes readable Simplified Chinese when requested", () => {
    const letter = buildOutreachLetter({
      companyName: "华康医疗",
      businessSummary: "在华东地区经营伤口护理和运动康复产品分销业务",
      recommendedProducts: ["运动肌贴", "自粘绷带"],
      contactName: "李经理",
      language: "简体中文"
    });

    expect(letter.subject).toContain("华康医疗");
    expect(letter.subject).toContain("原研");
    expect(letter.body).toContain("李经理");
    expect(letter.body).toContain("在华东地区经营伤口护理和运动康复产品分销业务");
    expect(letter.body).toContain("常州");
    expect(letter.body).toContain("ISO13485");
    expect(letter.body).toContain("CE");
    expect(letter.body).toContain("FDA");
    expect(letter.body).toContain("OEM/ODM");
    expect(letter.body).toContain("验厂");
    expect(letter.body).toContain("PDF目录");
  });
});
