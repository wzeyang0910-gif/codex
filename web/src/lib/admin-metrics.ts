import type { SessionUser } from "@/lib/auth";

export const ADMIN_TASK_STATUSES = ["queued", "running", "partial", "completed", "failed"] as const;

export type AdminTaskStatus = (typeof ADMIN_TASK_STATUSES)[number];

export type ProviderUsageMetric = {
  provider: string;
  calls: number;
  creditsUsed: number;
  failedCalls: number;
};

export type ApiConfigurationMetric = {
  provider: "Prospeo" | "Hunter" | "Apify" | "ContactOut";
  configured: boolean;
};

export type AdminMetricInput = {
  taskCount: number;
  taskStatusCounts?: Partial<Record<AdminTaskStatus, number>>;
  deliveredCount: number;
  rejectedCount: number;
  apiCreditsUsed: number;
  failedApiCalls: number;
  providerUsage?: ProviderUsageMetric[];
  apiConfiguration?: ApiConfigurationMetric[];
};

export type AdminMetricOutput = {
  taskCount: number;
  taskStatusCounts: Record<AdminTaskStatus, number>;
  deliveredCount: number;
  rejectedCount: number;
  validCustomerRate: string;
  failedApiCalls: number;
  apiCreditsUsed: number;
  averageCreditsPerDeliveredCustomer: string;
  providerUsage: ProviderUsageMetric[];
  apiConfiguration: ApiConfigurationMetric[];
  alerts: string[];
};

export type AdminAccessDecision = { allowed: true } | { allowed: false; status: 401 | 403 };

export function adminAccessDecision(user: Pick<SessionUser, "role"> | null): AdminAccessDecision {
  if (!user) {
    return { allowed: false, status: 401 };
  }

  return user.role === "admin" ? { allowed: true } : { allowed: false, status: 403 };
}

export function buildAdminMetrics(input: AdminMetricInput): AdminMetricOutput {
  const totalReviewed = input.deliveredCount + input.rejectedCount;
  const validRate = totalReviewed === 0 ? 0 : (input.deliveredCount / totalReviewed) * 100;
  const creditsPerCustomer = input.deliveredCount === 0 ? 0 : input.apiCreditsUsed / input.deliveredCount;
  const taskStatusCounts = Object.fromEntries(
    ADMIN_TASK_STATUSES.map((status) => [status, input.taskStatusCounts?.[status] ?? 0])
  ) as Record<AdminTaskStatus, number>;

  return {
    taskCount: input.taskCount,
    taskStatusCounts,
    deliveredCount: input.deliveredCount,
    rejectedCount: input.rejectedCount,
    validCustomerRate: `${validRate.toFixed(1)}%`,
    failedApiCalls: input.failedApiCalls,
    apiCreditsUsed: input.apiCreditsUsed,
    averageCreditsPerDeliveredCustomer: creditsPerCustomer.toFixed(2),
    providerUsage: input.providerUsage?.map((provider) => ({ ...provider })) ?? [],
    apiConfiguration: input.apiConfiguration?.map((provider) => ({ ...provider })) ?? [],
    alerts:
      input.failedApiCalls > 0
        ? [`存在 ${input.failedApiCalls} 次接口失败，需要检查供应商或余额`]
        : []
  };
}
