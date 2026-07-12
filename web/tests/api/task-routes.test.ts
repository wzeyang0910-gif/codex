import { beforeEach, describe, expect, it, vi } from "vitest";
import { signSessionToken } from "@/lib/session-token";

const mocks = vi.hoisted(() => ({
  after: vi.fn(),
  processLeadTask: vi.fn(),
  transaction: vi.fn(),
  countCompanies: vi.fn(),
  aggregateTasks: vi.fn(),
  createTask: vi.fn(),
  findTask: vi.fn(),
  findCompany: vi.fn(),
  updateCompany: vi.fn()
}));

vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof import("next/server")>("next/server");
  return { ...actual, after: mocks.after };
});

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: mocks.transaction,
    leadTask: {
      create: mocks.createTask,
      aggregate: mocks.aggregateTasks,
      findUnique: mocks.findTask
    },
    company: {
      count: mocks.countCompanies,
      findUnique: mocks.findCompany,
      update: mocks.updateCompany
    }
  }
}));

vi.mock("@/server/tasks/process-task", () => ({ processLeadTask: mocks.processLeadTask }));

import { PATCH } from "@/app/api/customers/[customerId]/route";
import { GET } from "@/app/api/tasks/[taskId]/route";
import * as TaskRoute from "@/app/api/tasks/route";

const secret = "task-route-session-secret";
const owner = { id: "owner_1", name: "Owner", email: "owner@example.com", role: "sales" as const };
const otherSalesUser = { id: "other_1", name: "Other", email: "other@example.com", role: "sales" as const };
const validTaskPayload = {
  targetRegion: "Middle East",
  targetCountries: ["Saudi Arabia"],
  productKeys: ["kinesiology_tape"],
  customerTypes: ["distributor"]
};

function requestFor(user: typeof owner, input: RequestInit = {}): Request {
  const token = signSessionToken(user, { secret, expiresInSeconds: 60 });
  return new Request("http://localhost/api/test", {
    ...input,
    headers: { cookie: `yonye_session=${token}`, ...input.headers }
  });
}

describe("Task 7 protected routes", () => {
  beforeEach(() => {
    process.env.SESSION_SECRET = secret;
    vi.resetAllMocks();
  });

  it("returns 401 before loading a task when the request has no session", async () => {
    const response = await GET(new Request("http://localhost/api/tasks/missing"), {
      params: Promise.resolve({ taskId: "missing" })
    });

    expect(response.status).toBe(401);
    expect(mocks.findTask).not.toHaveBeenCalled();
  });

  it("returns 401 before parsing or loading a customer when the request has no session", async () => {
    const response = await PATCH(
      new Request("http://localhost/api/customers/missing", { method: "PATCH", body: JSON.stringify({}) }),
      { params: Promise.resolve({ customerId: "missing" }) }
    );

    expect(response.status).toBe(401);
    expect(mocks.findCompany).not.toHaveBeenCalled();
  });

  it("returns 403 only after task ownership is checked for an authenticated sales user", async () => {
    mocks.findTask.mockResolvedValue({ userId: owner.id });

    const response = await GET(requestFor(otherSalesUser), { params: Promise.resolve({ taskId: "task_1" }) });

    expect(response.status).toBe(403);
    expect(mocks.findTask).toHaveBeenCalledOnce();
  });

  it("returns 403 before updating a customer owned by another sales user", async () => {
    mocks.findCompany.mockResolvedValue({ ownerId: owner.id });

    const response = await PATCH(requestFor(otherSalesUser, { method: "PATCH", body: JSON.stringify({ notes: "note" }) }), {
      params: Promise.resolve({ customerId: "customer_1" })
    });

    expect(response.status).toBe(403);
    expect(mocks.updateCompany).not.toHaveBeenCalled();
  });

  it("returns 403 before validating an empty update from another sales user", async () => {
    mocks.findCompany.mockResolvedValue({ ownerId: owner.id });

    const response = await PATCH(requestFor(otherSalesUser, { method: "PATCH", body: JSON.stringify({}) }), {
      params: Promise.resolve({ customerId: "customer_1" })
    });

    expect(response.status).toBe(403);
    expect(mocks.updateCompany).not.toHaveBeenCalled();
  });

  it("reduces remaining quota by today's queued task reservations", async () => {
    mocks.countCompanies.mockResolvedValue(20);
    mocks.aggregateTasks.mockResolvedValue({ _sum: { targetCount: 5 } });
    mocks.createTask.mockResolvedValue({ id: "task_1", status: "queued" });
    mocks.transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        company: { count: mocks.countCompanies },
        leadTask: { aggregate: mocks.aggregateTasks, create: mocks.createTask }
      })
    );

    const response = await TaskRoute.POST(
      requestFor(owner, { method: "POST", body: JSON.stringify(validTaskPayload) })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ remaining: 0 });
  });

  it("creates the task inside a Serializable transaction", async () => {
    mocks.countCompanies.mockResolvedValue(0);
    mocks.aggregateTasks.mockResolvedValue({ _sum: { targetCount: 0 } });
    mocks.createTask.mockResolvedValue({ id: "task_1", status: "queued" });
    mocks.transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        company: { count: mocks.countCompanies },
        leadTask: { aggregate: mocks.aggregateTasks, create: mocks.createTask }
      })
    );

    await TaskRoute.POST(requestFor(owner, { method: "POST", body: JSON.stringify(validTaskPayload) }));

    expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "Serializable" });
    expect(mocks.createTask).toHaveBeenCalledOnce();
  });

  it("returns a retry response without scheduling work when the reservation transaction conflicts", async () => {
    mocks.countCompanies.mockResolvedValue(0);
    mocks.createTask.mockResolvedValue({ id: "task_1", status: "queued" });
    mocks.transaction.mockRejectedValue(Object.assign(new Error("serialization conflict"), { code: "P2034" }));

    const response = await TaskRoute.POST(
      requestFor(owner, { method: "POST", body: JSON.stringify(validTaskPayload) })
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ error: "任务创建冲突，请稍后重试" });
    expect(mocks.after).not.toHaveBeenCalled();
  });

  it("uses Asia/Shanghai UTC day bounds at both China-midnight edges", () => {
    const shanghaiDayBounds = (TaskRoute as unknown as {
      shanghaiDayBounds?: (now: Date) => { start: Date; end: Date };
    }).shanghaiDayBounds;

    expect(shanghaiDayBounds).toBeTypeOf("function");
    expect(shanghaiDayBounds!(new Date("2026-07-12T15:59:59.999Z"))).toEqual({
      start: new Date("2026-07-11T16:00:00.000Z"),
      end: new Date("2026-07-12T16:00:00.000Z")
    });
    expect(shanghaiDayBounds!(new Date("2026-07-12T16:00:00.000Z"))).toEqual({
      start: new Date("2026-07-12T16:00:00.000Z"),
      end: new Date("2026-07-13T16:00:00.000Z")
    });
  });

  it("absorbs a rejected post-response task callback", async () => {
    let callback: (() => unknown) | undefined;
    mocks.countCompanies.mockResolvedValue(0);
    mocks.aggregateTasks.mockResolvedValue({ _sum: { targetCount: 0 } });
    mocks.createTask.mockResolvedValue({ id: "task_1", status: "queued" });
    mocks.transaction.mockImplementation(async (scheduled: (tx: unknown) => Promise<unknown>) =>
      scheduled({
        company: { count: mocks.countCompanies },
        leadTask: { aggregate: mocks.aggregateTasks, create: mocks.createTask }
      })
    );
    mocks.after.mockImplementation((scheduled: () => unknown) => {
      callback = scheduled;
    });
    mocks.processLeadTask.mockRejectedValue(new Error("task processing failed"));

    const response = await TaskRoute.POST(
      requestFor(owner, { method: "POST", body: JSON.stringify(validTaskPayload) })
    );

    expect(response.status).toBe(200);
    expect(callback).toBeTypeOf("function");
    await expect(callback!()).resolves.toBeUndefined();
  });
});
