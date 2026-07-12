import { after, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { CreateTaskSchema } from "@/lib/api-contracts";
import { canCreateTask } from "@/lib/quota";
import { getSessionFromRequest } from "@/lib/session";
import { prisma } from "@/lib/db";
import { processLeadTask } from "@/server/tasks/process-task";

export { CreateTaskSchema, UpdateCustomerSchema } from "@/lib/api-contracts";

const REQUESTED_COUNT = 5;
const SHANGHAI_UTC_OFFSET_MS = 8 * 60 * 60 * 1000;

export function shanghaiDayBounds(now: Date): { start: Date; end: Date } {
  const dateParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(now);
  const values = new Map(dateParts.map((part) => [part.type, part.value]));
  const year = Number(values.get("year"));
  const month = Number(values.get("month"));
  const day = Number(values.get("day"));
  const start = new Date(Date.UTC(year, month - 1, day) - SHANGHAI_UTC_OFFSET_MS);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

  return { start, end };
}

function isSerializationConflict(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2034";
}

export async function POST(request: Request) {
  const user = getSessionFromRequest(request);

  if (!user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = CreateTaskSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: "任务参数不完整" }, { status: 400 });
  }

  const { start, end } = shanghaiDayBounds(new Date());
  let reservation: {
    quota: ReturnType<typeof canCreateTask>;
    task?: { id: string; status: string };
  };

  try {
    reservation = await prisma.$transaction(
      async (transaction) => {
        const [deliveredToday, pendingTasks] = await Promise.all([
          transaction.company.count({
            where: {
              ownerId: user.id,
              isDelivered: true,
              deliveredAt: { gte: start, lt: end }
            }
          }),
          transaction.leadTask.aggregate({
            where: {
              userId: user.id,
              status: { in: ["queued", "running"] },
              createdAt: { gte: start, lt: end }
            },
            _sum: { targetCount: true }
          })
        ]);
        const quota = canCreateTask(deliveredToday + (pendingTasks._sum.targetCount ?? 0), REQUESTED_COUNT);

        if (!quota.allowed) {
          return { quota };
        }

        const task = await transaction.leadTask.create({
          data: {
            userId: user.id,
            targetRegion: parsed.data.targetRegion,
            targetCountries: parsed.data.targetCountries,
            productKeys: parsed.data.productKeys,
            customerTypes: parsed.data.customerTypes,
            language: parsed.data.language,
            extraKeywords: parsed.data.extraKeywords,
            targetCount: REQUESTED_COUNT,
            status: "queued"
          }
        });

        return { quota, task };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  } catch (error) {
    if (isSerializationConflict(error)) {
      return NextResponse.json({ error: "任务创建冲突，请稍后重试" }, { status: 409 });
    }

    throw error;
  }

  if (!reservation.quota.allowed) {
    return NextResponse.json({ error: reservation.quota.reason, remaining: reservation.quota.remaining }, { status: 429 });
  }

  const task = reservation.task!;

  after(async () => {
    try {
      await processLeadTask(task.id);
    } catch {
      // Processing errors are handled by the worker and must not reject after the response.
    }
  });

  return NextResponse.json({ taskId: task.id, status: task.status, remaining: reservation.quota.remaining });
}
