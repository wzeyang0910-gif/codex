import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

function providerMode() {
  return process.env.USE_MOCK_ADAPTERS === "false" ? "live" : "mock";
}

export async function GET() {
  const checkedAt = new Date().toISOString();
  const headers = { "Cache-Control": "no-store" };

  try {
    await prisma.$queryRaw`SELECT 1 AS ok`;
    return NextResponse.json({
      status: "ok",
      database: "ok",
      providerMode: providerMode(),
      checkedAt
    }, { status: 200, headers });
  } catch {
    return NextResponse.json({
      status: "degraded",
      database: "unavailable",
      providerMode: providerMode(),
      checkedAt
    }, { status: 503, headers });
  }
}
