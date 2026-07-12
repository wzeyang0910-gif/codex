import { after, NextResponse } from "next/server";
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
  const deliveredToday = await prisma.company.count({
    where: {
      ownerId: user.id,
      isDelivered: true,
      deliveredAt: { gte: start, lt: end }
    }
  });
  const quota = canCreateTask(deliveredToday, REQUESTED_COUNT);

  if (!quota.allowed) {
    return NextResponse.json({ error: quota.reason, remaining: quota.remaining }, { status: 429 });
  }

  const task = await prisma.leadTask.create({
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

  after(async () => {
    try {
      await processLeadTask(task.id);
    } catch {
      // Processing errors are handled by the worker and must not reject after the response.
    }
  });

  return NextResponse.json({ taskId: task.id, status: task.status, remaining: quota.remaining });
}
