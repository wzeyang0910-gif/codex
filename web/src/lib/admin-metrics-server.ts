import {
  buildAdminMetrics,
  type AdminMetricOutput,
  type AdminTaskStatus,
  type ApiConfigurationMetric,
  type ProviderUsageMetric
} from "@/lib/admin-metrics";
import { prisma } from "@/lib/db";

const PROVIDER_ENVIRONMENT_VARIABLES = [
  ["Prospeo", "PROSPEO_API_KEY"],
  ["Hunter", "HUNTER_API_KEY"],
  ["Apify", "APIFY_API_KEY"],
  ["ContactOut", "CONTACTOUT_API_KEY"]
] as const;

function readApiConfiguration(): ApiConfigurationMetric[] {
  return PROVIDER_ENVIRONMENT_VARIABLES.map(([provider, environmentVariable]) => ({
    provider,
    configured: Boolean(process.env[environmentVariable]?.trim())
  }));
}

export async function loadAdminMetrics(): Promise<AdminMetricOutput> {
  const [taskGroups, deliveredCount, apiGroups] = await Promise.all([
    prisma.leadTask.groupBy({
      by: ["status"],
      _count: { _all: true },
      _sum: { rejectedCount: true }
    }),
    prisma.company.count({ where: { isDelivered: true } }),
    prisma.apiCallLog.groupBy({
      by: ["provider", "status"],
      _count: { _all: true },
      _sum: { creditsUsed: true }
    })
  ]);

  const taskStatusCounts: Partial<Record<AdminTaskStatus, number>> = {};
  let taskCount = 0;
  let rejectedCount = 0;

  for (const group of taskGroups) {
    taskStatusCounts[group.status] = group._count._all;
    taskCount += group._count._all;
    rejectedCount += group._sum.rejectedCount ?? 0;
  }

  const providerUsageByName = new Map<string, ProviderUsageMetric>();
  let apiCreditsUsed = 0;
  let failedApiCalls = 0;

  for (const group of apiGroups) {
    const calls = group._count._all;
    const creditsUsed = group._sum.creditsUsed ?? 0;
    const failedCalls = group.status === "failed" ? calls : 0;
    const current = providerUsageByName.get(group.provider) ?? {
      provider: group.provider,
      calls: 0,
      creditsUsed: 0,
      failedCalls: 0
    };

    current.calls += calls;
    current.creditsUsed += creditsUsed;
    current.failedCalls += failedCalls;
    providerUsageByName.set(group.provider, current);
    apiCreditsUsed += creditsUsed;
    failedApiCalls += failedCalls;
  }

  const providerUsage = [...providerUsageByName.values()].sort((left, right) =>
    left.provider.localeCompare(right.provider, "en")
  );

  return buildAdminMetrics({
    taskCount,
    taskStatusCounts,
    deliveredCount,
    rejectedCount,
    apiCreditsUsed,
    failedApiCalls,
    providerUsage,
    apiConfiguration: readApiConfiguration()
  });
}
