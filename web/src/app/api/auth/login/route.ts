import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createSessionToken, SESSION_COOKIE_NAME, sessionCookieOptions } from "@/lib/session";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "邮箱或密码格式不正确" },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email }
  });

  if (!user) {
    return NextResponse.json(
      { error: "邮箱或密码错误" },
      { status: 401 }
    );
  }

  const passwordMatches = await bcrypt.compare(
    parsed.data.password,
    user.passwordHash
  );

  if (!passwordMatches) {
    return NextResponse.json(
      { error: "邮箱或密码错误" },
      { status: 401 }
    );
  }

  let token: string;

  try {
    token = createSessionToken({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    });
  } catch {
    return NextResponse.json(
      { error: "登录服务暂不可用" },
      { status: 500 }
    );
  }

  const response = NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    }
  });

  response.cookies.set(SESSION_COOKIE_NAME, token, sessionCookieOptions());

  return response;
}
