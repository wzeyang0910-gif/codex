import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ queryRaw: vi.fn() }));

vi.mock("@/lib/db", () => ({
  prisma: { $queryRaw: mocks.queryRaw }
}));

import { GET } from "@/app/api/health/route";

describe("health route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.USE_MOCK_ADAPTERS = "true";
  });

  it("returns a minimal healthy response when the database is reachable", async () => {
    mocks.queryRaw.mockResolvedValue([{ ok: 1 }]);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      status: "ok",
      database: "ok",
      providerMode: "mock"
    });
    expect(body.checkedAt).toEqual(expect.any(String));
    expect(JSON.stringify(body)).not.toContain("DATABASE_URL");
  });

  it("returns 503 without exposing database errors when the database is unavailable", async () => {
    mocks.queryRaw.mockRejectedValue(new Error("password secret-db-password"));

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toMatchObject({
      status: "degraded",
      database: "unavailable",
      providerMode: "mock"
    });
    expect(JSON.stringify(body)).not.toContain("secret-db-password");
  });
});
