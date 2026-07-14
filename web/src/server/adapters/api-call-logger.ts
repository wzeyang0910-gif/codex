import type { ProviderCallEvent, ProviderCallObserver } from "./types";

type ApiCallLogStore = {
  apiCallLog?: {
    create(args: { data: Record<string, unknown> }): Promise<unknown>;
  };
};

type ApiCallContext = {
  userId: string;
  taskId: string;
};

export function createApiCallLogger(
  store: ApiCallLogStore,
  context: ApiCallContext
): ProviderCallObserver {
  return async (event: ProviderCallEvent) => {
    if (!store.apiCallLog) return;
    try {
      await store.apiCallLog.create({
        data: {
          userId: context.userId,
          taskId: context.taskId,
          provider: event.provider,
          endpoint: event.endpoint,
          status: event.status,
          creditsUsed: event.creditsUsed,
          durationMs: event.durationMs,
          error: event.error ?? null
        }
      });
    } catch {
      // A telemetry write must never fail the lead task.
    }
  };
}
