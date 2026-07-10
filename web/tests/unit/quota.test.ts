import { describe, expect, it } from "vitest";
import { canCreateTask } from "@/lib/quota";

describe("daily customer quota", () => {
  it("allows a 5-customer task when the user has room", () => {
    expect(canCreateTask(25, 5)).toEqual({ allowed: true, remaining: 0 });
  });

  it("blocks a task above the 30-customer daily limit", () => {
    expect(canCreateTask(30, 5)).toEqual({
      allowed: false,
      remaining: 0,
      reason: "今日额度已用完"
    });
  });

  it("blocks a task when only part of the requested quota remains", () => {
    expect(canCreateTask(28, 5)).toEqual({
      allowed: false,
      remaining: 2,
      reason: "今日剩余额度不足，仅剩 2 家"
    });
  });
});
