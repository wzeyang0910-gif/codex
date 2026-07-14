import { describe, expect, it, vi } from "vitest";
import { createApiCallLogger } from "@/server/adapters/api-call-logger";

describe("API call logger", () => {
  it("stores provider telemetry against the current user and task", async () => {
    const create = vi.fn(async () => ({}));
    const log = createApiCallLogger({ apiCallLog: { create } }, {
      userId: "user-1",
      taskId: "task-1"
    });

    await log({
      provider: "Prospeo",
      endpoint: "search-company",
      status: "success",
      creditsUsed: 1,
      durationMs: 245
    });

    expect(create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        taskId: "task-1",
        provider: "Prospeo",
        endpoint: "search-company",
        status: "success",
        creditsUsed: 1,
        durationMs: 245,
        error: null
      }
    });
  });

  it("does not fail the lead task when telemetry storage fails", async () => {
    const log = createApiCallLogger({
      apiCallLog: { create: vi.fn(async () => { throw new Error("database unavailable"); }) }
    }, { userId: "user-1", taskId: "task-1" });

    await expect(log({
      provider: "Hunter",
      endpoint: "domain-search",
      status: "error",
      creditsUsed: 0,
      durationMs: 500,
      error: "HTTP_503"
    })).resolves.toBeUndefined();
  });
});
