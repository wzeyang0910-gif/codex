import { beforeEach, describe, expect, it, vi } from "vitest";
import { signSessionToken } from "@/lib/session-token";

const mocks = vi.hoisted(() => ({
  groupTasks: vi.fn(),
  countDeliveredCompanies: vi.fn(),
  groupApiCalls: vi.fn()
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    leadTask: { groupBy: mocks.groupTasks },
    company: { count: mocks.countDeliveredCompanies },
    apiCallLog: { groupBy: mocks.groupApiCalls }
  }
}));

import { GET } from "@/app/api/admin/metrics/route";

const secret = "admin-metrics-route-secret";
const admin = { id: "admin_1", name: "Admin", email: "admin@example.com", role: "admin" as const };
const sales = { id: "sales_1", name: "Sales", email: "sales@example.com", role: "sales" as const };

function requestFor(user?: typeof admin | typeof sales): Request {
  const headers = new Headers();

  if (user) {
    const token = signSessionToken(user, { secret, expiresInSeconds: 60 });
    headers.set("cookie", `yonye_session=${token}`);
  }

  return new Request("http://localhost/api/admin/metrics", { headers });
}

describe("admin metrics route", () => {
  beforeEach(() => {
    process.env.SESSION_SECRET = secret;
    process.env.PROSPEO_API_KEY = "prospeo-secret";
    process.env.HUNTER_API_KEY = "";
    process.env.APIFY_API_KEY = "apify-secret";
    process.env.CONTACTOUT_API_KEY = "   ";
    vi.resetAllMocks();
  });

  it("returns 401 without querying Prisma when the session is missing", async () => {
    const response = await GET(requestFor());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "请先登录" });
    expect(mocks.groupTasks).not.toHaveBeenCalled();
    expect(mocks.countDeliveredCompanies).not.toHaveBeenCalled();
    expect(mocks.groupApiCalls).not.toHaveBeenCalled();
  });

  it("returns 403 without querying Prisma for a sales session", async () => {
    const response = await GET(requestFor(sales));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "权限不足" });
    expect(mocks.groupTasks).not.toHaveBeenCalled();
    expect(mocks.countDeliveredCompanies).not.toHaveBeenCalled();
    expect(mocks.groupApiCalls).not.toHaveBeenCalled();
  });

  it("returns aggregate metrics and configuration flags without exposing API keys", async () => {
    mocks.groupTasks.mockResolvedValue([
      { status: "completed", _count: { _all: 2 }, _sum: { rejectedCount: 3 } },
      { status: "queued", _count: { _all: 1 }, _sum: { rejectedCount: 1 } }
    ]);
    mocks.countDeliveredCompanies.mockResolvedValue(5);
    mocks.groupApiCalls.mockResolvedValue([
      { provider: "Prospeo", status: "success", _count: { _all: 3 }, _sum: { creditsUsed: 12 } },
      { provider: "Prospeo", status: "failed", _count: { _all: 1 }, _sum: { creditsUsed: 2 } },
      { provider: "Hunter", status: "success", _count: { _all: 2 }, _sum: { creditsUsed: 4 } }
    ]);

    const response = await GET(requestFor(admin));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      taskCount: 3,
      deliveredCount: 5,
      rejectedCount: 4,
      failedApiCalls: 1,
      apiCreditsUsed: 18,
      validCustomerRate: "55.6%",
      averageCreditsPerDeliveredCustomer: "3.60",
      providerUsage: [
        { provider: "Hunter", calls: 2, creditsUsed: 4, failedCalls: 0 },
        { provider: "Prospeo", calls: 4, creditsUsed: 14, failedCalls: 1 }
      ],
      apiConfiguration: [
        { provider: "Prospeo", configured: true },
        { provider: "Hunter", configured: false },
        { provider: "Apify", configured: true },
        { provider: "ContactOut", configured: false }
      ]
    });
    expect(JSON.stringify(body)).not.toContain("prospeo-secret");
    expect(JSON.stringify(body)).not.toContain("apify-secret");
    expect(mocks.groupTasks).toHaveBeenCalledWith({
      by: ["status"],
      _count: { _all: true },
      _sum: { rejectedCount: true }
    });
    expect(mocks.countDeliveredCompanies).toHaveBeenCalledWith({ where: { isDelivered: true } });
    expect(mocks.groupApiCalls).toHaveBeenCalledWith({
      by: ["provider", "status"],
      _count: { _all: true },
      _sum: { creditsUsed: true }
    });
  });
});
