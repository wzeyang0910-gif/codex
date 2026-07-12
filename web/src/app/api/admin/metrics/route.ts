import { NextResponse } from "next/server";
import { adminAccessDecision } from "@/lib/admin-metrics";
import { loadAdminMetrics } from "@/lib/admin-metrics-server";
import { getSessionFromRequest } from "@/lib/session";

export async function GET(request: Request) {
  const access = adminAccessDecision(getSessionFromRequest(request));

  if (!access.allowed) {
    const error = access.status === 401 ? "请先登录" : "权限不足";
    return NextResponse.json({ error }, { status: access.status });
  }

  return NextResponse.json(await loadAdminMetrics());
}
