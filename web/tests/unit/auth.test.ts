import { describe, expect, it } from "vitest";
import { requireRole } from "@/lib/auth";

describe("role checks", () => {
  it("allows admin to access admin pages", () => {
    expect(() => requireRole("admin", ["admin"])).not.toThrow();
  });

  it("allows sales to access sales pages", () => {
    expect(() => requireRole("sales", ["sales", "admin"])).not.toThrow();
  });

  it("blocks sales from admin pages", () => {
    expect(() => requireRole("sales", ["admin"])).toThrow("权限不足");
  });
});
