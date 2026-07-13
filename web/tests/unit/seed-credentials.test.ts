import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const seedSource = readFileSync(resolve(process.cwd(), "prisma/seed.ts"), "utf8");

describe("seed credentials", () => {
  it("requires separate administrator and sales passwords from the environment", () => {
    expect(seedSource).toContain("SEED_ADMIN_PASSWORD");
    expect(seedSource).toContain("SEED_SALES_PASSWORD");
    expect(seedSource).toMatch(/throw new Error/);
  });

  it("rejects weak passwords before seeding", () => {
    expect(seedSource).toMatch(/password\.length\s*<\s*12/);
    expect(seedSource).toMatch(/weak|强|complex/i);
  });

  it("requires administrator and sales passwords to be different", () => {
    expect(seedSource).toMatch(/adminPassword\s*===\s*salesPassword/);
    expect(seedSource).toMatch(/different|不同/i);
  });

  it("updates password hashes, names, and roles when seed is repeated", () => {
    expect(seedSource).toMatch(/update:\s*{[^}]*name[^}]*passwordHash[^}]*role[^}]*}/s);
  });

  it("does not contain known or literal default credentials", () => {
    expect(seedSource).not.toContain("123456");
    expect(seedSource).not.toMatch(/bcrypt\.hash\(\s*["'][^"']+["']/);
  });
});
