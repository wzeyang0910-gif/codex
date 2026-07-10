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
      reason: "今日额度已用完"
    };
  }

  if (requestedCount > remaining) {
    return {
      allowed: false,
      remaining,
      reason: `今日剩余额度不足，仅剩 ${remaining} 家`
    };
  }

  return {
    allowed: true,
    remaining: remaining - requestedCount
  };
}
