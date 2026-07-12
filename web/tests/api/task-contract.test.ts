import { describe, expect, it } from "vitest";
import { CreateTaskSchema, UpdateCustomerSchema } from "@/lib/api-contracts";
import { canAccessOwner, ownershipDecision } from "@/lib/session";

const validTaskPayload = {
  targetRegion: "Middle East",
  targetCountries: ["Saudi Arabia"],
  productKeys: ["kinesiology_tape"],
  customerTypes: ["distributor"],
  language: "English",
  extraKeywords: ["Saudi importer"]
};

describe("API contracts", () => {
  it("accepts a valid task payload without browser-supplied user identity", () => {
    const parsed = CreateTaskSchema.safeParse(validTaskPayload);

    expect(parsed.success).toBe(true);
  });

  it("rejects browser-supplied user identity in task creation", () => {
    const parsed = CreateTaskSchema.safeParse({
      ...validTaskPayload,
      userId: "browser_user"
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects customer update without editable fields", () => {
    const parsed = UpdateCustomerSchema.safeParse({});

    expect(parsed.success).toBe(false);
  });

  it("allows owners and admins but blocks other sales users", () => {
    expect(canAccessOwner({ id: "owner_1", name: "A", email: "a@example.com", role: "sales" }, "owner_1")).toBe(true);
    expect(canAccessOwner({ id: "other_1", name: "B", email: "b@example.com", role: "sales" }, "owner_1")).toBe(false);
    expect(canAccessOwner({ id: "admin_1", name: "Admin", email: "admin@example.com", role: "admin" }, "owner_1")).toBe(true);
  });

  it("maps missing sessions to 401 and wrong owners to 403", () => {
    expect(ownershipDecision(null, "owner_1")).toEqual({ allowed: false, status: 401 });
    expect(
      ownershipDecision({ id: "other_1", name: "B", email: "b@example.com", role: "sales" }, "owner_1")
    ).toEqual({ allowed: false, status: 403 });
    expect(
      ownershipDecision({ id: "admin_1", name: "Admin", email: "admin@example.com", role: "admin" }, "owner_1")
    ).toEqual({ allowed: true });
  });
});
