import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const schemaPath = path.resolve(__dirname, "../../prisma/schema.prisma");
const schema = readFileSync(schemaPath, "utf8");

function getModelBlock(name: string): string {
  const match = schema.match(new RegExp(`model\\s+${name}\\s+\\{[\\s\\S]*?\\n\\}`, "m"));
  expect(match, `Expected model ${name} to exist in schema.prisma`).not.toBeNull();
  return match![0];
}

describe("Prisma schema contract", () => {
  it("keeps Company dedupe and delivery fields aligned with Task 2 review requirements", () => {
    const companyBlock = getModelBlock("Company");

    expect(companyBlock).toContain("normalizedName      String");
    expect(companyBlock).not.toContain("normalizedBrand");
    expect(companyBlock).toContain("domain              String?");
    expect(companyBlock).toContain("country             String");
    expect(companyBlock).toContain("region              String");
    expect(companyBlock).toContain("brandNames          String[]");
    expect(companyBlock).toContain("brands              CompanyBrand[]");
    expect(companyBlock).toContain("deliveredAt         DateTime?");
    expect(companyBlock).toContain("@@unique([normalizedName, country, region])");
    expect(companyBlock).toContain("@@unique([domain, country, region])");
  });

  it("models multiple normalized brand names per company for dedupe checks", () => {
    const companyBrandBlock = getModelBlock("CompanyBrand");

    expect(companyBrandBlock).toContain("companyId      String");
    expect(companyBrandBlock).toMatch(/company\s+Company\s+@relation\(fields: \[companyId\], references: \[id\]/);
    expect(companyBrandBlock).toContain("name           String");
    expect(companyBrandBlock).toContain("normalizedName String");
    expect(companyBrandBlock).toContain("country        String");
    expect(companyBrandBlock).toContain("region         String");
    expect(companyBrandBlock).toContain("@@index([companyId])");
    expect(companyBrandBlock).toContain("@@unique([normalizedName, country, region])");
    expect(companyBrandBlock).not.toContain("@@unique([companyId, normalizedName, country, region])");
  });

  it("keeps ApiCallLog attributable to user, task, and company", () => {
    const userBlock = getModelBlock("User");
    const leadTaskBlock = getModelBlock("LeadTask");
    const companyBlock = getModelBlock("Company");
    const apiCallLogBlock = getModelBlock("ApiCallLog");

    expect(userBlock).toContain("apiCallLogs  ApiCallLog[]");
    expect(leadTaskBlock).toContain("apiCallLogs     ApiCallLog[]");
    expect(companyBlock).toContain("apiCallLogs         ApiCallLog[]");

    expect(apiCallLogBlock).toMatch(/userId\s+String\s*\n/);
    expect(apiCallLogBlock).toMatch(/taskId\s+String\s*\n/);
    expect(apiCallLogBlock).toMatch(/companyId\s+String\?/);
    expect(apiCallLogBlock).toMatch(/user\s+User\s+@relation\(fields: \[userId\], references: \[id\]\)/);
    expect(apiCallLogBlock).toMatch(/task\s+LeadTask\s+@relation\(fields: \[taskId\], references: \[id\]\)/);
    expect(apiCallLogBlock).toMatch(/company\s+Company\?\s+@relation\(fields: \[companyId\], references: \[id\]\)/);
    expect(apiCallLogBlock).toContain("@@index([userId, createdAt])");
    expect(apiCallLogBlock).toContain("@@index([taskId, createdAt])");
    expect(apiCallLogBlock).toContain("@@index([companyId, createdAt])");
  });

  it("preserves the internal non-delivered grade and bootstrap-only seed stance", () => {
    expect(schema).toMatch(/enum LeadGrade\s+\{[\s\S]*\bC\b[\s\S]*\}/m);
  });
});
