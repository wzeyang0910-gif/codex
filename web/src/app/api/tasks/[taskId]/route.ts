import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionFromRequest, ownershipDecision } from "@/lib/session";

export async function GET(request: Request, context: { params: Promise<{ taskId: string }> }) {
  const user = getSessionFromRequest(request);

  if (!user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const { taskId } = await context.params;
  const task = await prisma.leadTask.findUnique({
    where: { id: taskId },
    include: {
      companies: {
        include: {
          contacts: true,
          evidences: true,
          letters: true
        }
      }
    }
  });

  if (!task) {
    return NextResponse.json({ error: "任务不存在" }, { status: 404 });
  }

  const decision = ownershipDecision(user, task.userId);
  if (!decision.allowed) {
    return NextResponse.json({ error: decision.status === 401 ? "请先登录" : "无权访问该任务" }, { status: decision.status });
  }

  return NextResponse.json({ task });
}
