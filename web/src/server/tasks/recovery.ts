import { prisma as defaultPrisma } from "@/lib/db";
import { processLeadTask, STALE_RUNNING_TASK_MS } from "./process-task";

export { STALE_RUNNING_TASK_MS } from "./process-task";
export const TASK_RECOVERY_INTERVAL_MS = 60_000;

type RecoveryDependencies = {
  prisma?: {
    leadTask: {
      findMany(args: {
        where: Record<string, unknown>;
        select: { id: true };
        orderBy: { createdAt: "asc" };
        take: number;
      }): Promise<{ id: string }[]>;
    };
  };
  processTask?: (taskId: string) => Promise<void>;
  now?: () => Date;
};

const timerKey = Symbol.for("yonye.taskRecoveryTimer");
type RecoveryGlobal = typeof globalThis & { [timerKey]?: ReturnType<typeof setInterval> };

export async function scanRecoverableTasks(dependencies: RecoveryDependencies = {}): Promise<void> {
  const prisma = dependencies.prisma ?? defaultPrisma;
  const now = dependencies.now?.() ?? new Date();
  const tasks = await prisma.leadTask.findMany({
    where: {
      OR: [
        { status: "queued" },
        { status: "running", startedAt: { lt: new Date(now.getTime() - STALE_RUNNING_TASK_MS) } }
      ]
    },
    select: { id: true },
    orderBy: { createdAt: "asc" },
    take: 10
  });
  await Promise.all(tasks.map(({ id }) => (dependencies.processTask ?? processLeadTask)(id)));
}

export function startTaskRecovery(dependencies: RecoveryDependencies = {}): void {
  const recoveryGlobal = globalThis as RecoveryGlobal;
  if (recoveryGlobal[timerKey]) return;

  void scanRecoverableTasks(dependencies).catch(() => undefined);
  const timer = setInterval(() => {
    void scanRecoverableTasks(dependencies).catch(() => undefined);
  }, TASK_RECOVERY_INTERVAL_MS);
  timer.unref?.();
  recoveryGlobal[timerKey] = timer;
}
