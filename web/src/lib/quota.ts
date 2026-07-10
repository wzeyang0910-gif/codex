const DAILY_CUSTOMER_LIMIT = 30;

export function canCreateTask(
  deliveredToday: number,
  requestedCount: number
): { allowed: boolean; remaining: number; reason?: string } {
  const remaining = Math.max(DAILY_CUSTOMER_LIMIT - deliveredToday, 0);

  if (remaining === 0) {
    return {
      allowed: false,
      remaining,
      reason: "浠婃棩棰濆害宸茬敤瀹?"
    };
  }

  if (requestedCount > remaining) {
    return {
      allowed: false,
      remaining,
      reason: `浠婃棩鍓╀綑棰濆害涓嶈冻锛屼粎鍓?${remaining} 瀹?`
    };
  }

  return {
    allowed: true,
    remaining: remaining - requestedCount
  };
}
