import { describe, expect, it } from "vitest";
import { buildAdminMetrics } from "@/lib/admin-metrics";

describe("admin metrics", () => {
  it("summarizes task quality and provider API usage", () => {
    const metrics = buildAdminMetrics({
      taskCount: 4,
      taskStatusCounts: {
        queued: 1,
        running: 1,
        completed: 2
      },
      deliveredCount: 20,
      rejectedCount: 11,
      apiCreditsUsed: 87,
      failedApiCalls: 2,
      providerUsage: [
        { provider: "Prospeo", calls: 7, creditsUsed: 50, failedCalls: 1 },
        { provider: "Hunter", calls: 5, creditsUsed: 37, failedCalls: 1 }
      ],
      apiConfiguration: [
        { provider: "Prospeo", configured: true },
        { provider: "Hunter", configured: false },
        { provider: "Apify", configured: true },
        { provider: "ContactOut", configured: false }
      ]
    });

    expect(metrics.taskCount).toBe(4);
    expect(metrics.taskStatusCounts).toEqual({
      queued: 1,
      running: 1,
      partial: 0,
      completed: 2,
      failed: 0
    });
    expect(metrics.validCustomerRate).toBe("64.5%");
    expect(metrics.averageCreditsPerDeliveredCustomer).toBe("4.35");
    expect(metrics.providerUsage).toEqual([
      { provider: "Prospeo", calls: 7, creditsUsed: 50, failedCalls: 1 },
      { provider: "Hunter", calls: 5, creditsUsed: 37, failedCalls: 1 }
    ]);
    expect(metrics.alerts).toContain("存在 2 次接口失败，需要检查供应商或余额");
  });

  it("handles empty data and zero denominators deterministically", () => {
    const metrics = buildAdminMetrics({
      taskCount: 0,
      deliveredCount: 0,
      rejectedCount: 0,
      apiCreditsUsed: 0,
      failedApiCalls: 0
    });

    expect(metrics.taskStatusCounts).toEqual({
      queued: 0,
      running: 0,
      partial: 0,
      completed: 0,
      failed: 0
    });
    expect(metrics.validCustomerRate).toBe("0.0%");
    expect(metrics.averageCreditsPerDeliveredCustomer).toBe("0.00");
    expect(metrics.providerUsage).toEqual([]);
    expect(metrics.apiConfiguration).toEqual([]);
    expect(metrics.alerts).toEqual([]);
  });
});
