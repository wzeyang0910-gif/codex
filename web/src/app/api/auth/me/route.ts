import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/session";

export async function GET(request: Request) {
  const user = getSessionFromRequest(request);

  if (!user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  return NextResponse.json({ user });
}
