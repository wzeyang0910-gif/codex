import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  sessionUser: null as { id: string; name: string; email: string; role: "admin" | "sales" } | null,
  transaction: vi.fn(),
  findCompany: vi.fn(),
  findCompanyInTransaction: vi.fn(),
  updateCompany: vi.fn(),
  updateCompanies: vi.fn(),
  updateCompanyBrand: vi.fn()
}));

vi.mock("@/lib/session", async () => {
  const actual = await vi.importActual<typeof import("@/lib/session")>("@/lib/session");
  return { ...actual, getSessionFromRequest: () => mocks.sessionUser };
});

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: mocks.transaction,
    company: { findUnique: mocks.findCompany }
  }
}));

import { PATCH } from "@/app/api/customers/[customerId]/route";

const owner = { id: "owner_1", name: "Owner", email: "owner@example.com", role: "sales" as const };
const otherSalesUser = { id: "other_1", name: "Other", email: "other@example.com", role: "sales" as const };
const admin = { id: "admin_1", name: "Admin", email: "admin@example.com", role: "admin" as const };
const existingCustomer = {
  ownerId: owner.id,
  name: "Acme Medical Ltd",
  normalizedName: "acme medical"
};

function requestFor(user: typeof owner | typeof otherSalesUser | typeof admin, body: unknown): Request {
  mocks.sessionUser = user;
  return new Request("http://localhost/api/customers/customer_1", {
    method: "PATCH",
    body: JSON.stringify(body)
  });
}

function patch(request: Request) {
  return PATCH(request, { params: Promise.resolve({ customerId: "customer_1" }) });
}

describe("customer rename route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.sessionUser = null;
    mocks.findCompany.mockResolvedValue(existingCustomer);
    mocks.findCompanyInTransaction.mockResolvedValue(existingCustomer);
    mocks.updateCompany.mockResolvedValue({ id: "customer_1", ...existingCustomer });
    mocks.updateCompanies.mockResolvedValue({ count: 1 });
    mocks.updateCompanyBrand.mockResolvedValue({ count: 1 });
    mocks.transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        company: {
          findUnique: mocks.findCompanyInTransaction,
          update: mocks.updateCompany,
          updateMany: mocks.updateCompanies
        },
        companyBrand: { updateMany: mocks.updateCompanyBrand }
      })
    );
  });

  it("rejects an unauthenticated request before reading or writing the database", async () => {
    const response = await patch(
      new Request("http://localhost/api/customers/customer_1", {
        method: "PATCH",
        body: JSON.stringify({ name: "New Name" })
      })
    );

    expect(response.status).toBe(401);
    expect(mocks.findCompany).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rejects a non-owner before validating or writing", async () => {
    const request = requestFor(otherSalesUser, {});
    const response = await patch(request);

    expect(response.status).toBe(403);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("validates an owner's input before starting a transaction", async () => {
    const response = await patch(requestFor(owner, {}));

    expect(response.status).toBe(400);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("lets the owner update notes and status in one transaction without writing an identity", async () => {
    const response = await patch(requestFor(owner, { notes: "Called purchasing", status: "replied" }));

    expect(response.status).toBe(200);
    expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(mocks.updateCompany).toHaveBeenCalledWith({
      where: { id: "customer_1" },
      data: { notes: "Called purchasing", status: "replied" }
    });
    expect(mocks.updateCompanyBrand).not.toHaveBeenCalled();
  });

  it("lets an admin rename a customer and updates only its old legal identity", async () => {
    const response = await patch(requestFor(admin, { name: "Nova Health Trading", notes: "Renamed" }));

    expect(response.status).toBe(200);
    expect(mocks.findCompanyInTransaction).toHaveBeenCalledWith({
      where: { id: "customer_1" },
      select: { name: true, normalizedName: true }
    });
    expect(mocks.updateCompanies).toHaveBeenCalledWith({
      where: { id: "customer_1", name: "Acme Medical Ltd", normalizedName: "acme medical" },
      data: { name: "Nova Health Trading", normalizedName: "nova health", notes: "Renamed" }
    });
    expect(mocks.updateCompanyBrand).toHaveBeenCalledWith({
      where: { companyId: "customer_1", name: "Acme Medical Ltd", normalizedName: "acme medical" },
      data: { name: "Nova Health Trading", normalizedName: "nova health" }
    });
  });

  it("preserves real brands when a renamed legal name normalizes to the same identity", async () => {
    const response = await patch(requestFor(owner, { name: "ACME Medical Company" }));

    expect(response.status).toBe(200);
    expect(mocks.updateCompanyBrand).toHaveBeenCalledWith({
      where: { companyId: "customer_1", name: "Acme Medical Ltd", normalizedName: "acme medical" },
      data: { name: "ACME Medical Company", normalizedName: "acme medical" }
    });
  });

  it("returns 409 when the legal identity update conflicts inside the transaction", async () => {
    mocks.updateCompanyBrand.mockRejectedValue(Object.assign(new Error("duplicate identity"), { code: "P2002" }));

    const response = await patch(requestFor(owner, { name: "Existing Medical" }));

    expect(response.status).toBe(409);
    expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(mocks.updateCompanies).toHaveBeenCalledOnce();
    expect(mocks.updateCompanyBrand).toHaveBeenCalledOnce();
    await expect(response.json()).resolves.toMatchObject({ error: expect.any(String) });
  });

  it("uses the identity re-read inside the transaction instead of the stale authorization read", async () => {
    mocks.findCompanyInTransaction.mockResolvedValue({
      name: "Acme Medical Group",
      normalizedName: "acme medical group"
    });

    const response = await patch(requestFor(owner, { name: "Nova Health Trading" }));

    expect(response.status).toBe(200);
    expect(mocks.updateCompanies).toHaveBeenCalledWith({
      where: { id: "customer_1", name: "Acme Medical Group", normalizedName: "acme medical group" },
      data: { name: "Nova Health Trading", normalizedName: "nova health" }
    });
    expect(mocks.updateCompanyBrand).toHaveBeenCalledWith({
      where: { companyId: "customer_1", name: "Acme Medical Group", normalizedName: "acme medical group" },
      data: { name: "Nova Health Trading", normalizedName: "nova health" }
    });
  });

  it("returns 409 when another rename wins before the conditional company update", async () => {
    mocks.updateCompanies.mockResolvedValue({ count: 0 });

    const response = await patch(requestFor(owner, { name: "Nova Health Trading" }));

    expect(response.status).toBe(409);
    expect(mocks.updateCompanyBrand).not.toHaveBeenCalled();
  });

  it("returns 409 and aborts when the legal identity row is missing", async () => {
    mocks.updateCompanyBrand.mockResolvedValue({ count: 0 });

    const response = await patch(requestFor(owner, { name: "Nova Health Trading" }));

    expect(response.status).toBe(409);
    expect(mocks.updateCompanies).toHaveBeenCalledOnce();
    expect(mocks.updateCompanyBrand).toHaveBeenCalledOnce();
  });
});
