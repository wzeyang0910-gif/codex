import { afterEach, describe, expect, it, vi } from "vitest";

describe("task recovery", () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("scans queued and stale running tasks and sends each through the atomic worker", async () => {
    const findMany = vi.fn(async () => [{ id: "queued" }, { id: "stale" }]);
    const processTask = vi.fn(async () => undefined);
    const { scanRecoverableTasks, STALE_RUNNING_TASK_MS } = await import("@/server/tasks/recovery");
    const now = new Date("2026-07-13T00:00:00Z");

    await scanRecoverableTasks({ prisma: { leadTask: { findMany } }, processTask, now: () => now });

    expect(findMany).toHaveBeenCalledWith({
      where: { OR: [{ status: "queued" }, { status: "running", startedAt: { lt: new Date(now.getTime() - STALE_RUNNING_TASK_MS) } }] },
      select: { id: true },
      orderBy: { createdAt: "asc" },
      take: 10
    });
    expect(processTask).toHaveBeenCalledTimes(2);
  });

  it("starts only one unrefed recovery interval", async () => {
    const unref = vi.fn();
    const setIntervalSpy = vi.spyOn(globalThis, "setInterval").mockReturnValue({ unref } as unknown as ReturnType<typeof setInterval>);
    const { startTaskRecovery } = await import("@/server/tasks/recovery");
    const dependencies = { prisma: { leadTask: { findMany: async () => [] } }, processTask: async () => undefined };

    startTaskRecovery(dependencies);
    startTaskRecovery(dependencies);

    expect(setIntervalSpy).toHaveBeenCalledTimes(1);
    expect(unref).toHaveBeenCalledOnce();
  });
});
