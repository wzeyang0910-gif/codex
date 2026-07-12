import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { SessionUser } from "@/lib/auth";
import { SESSION_COOKIE_NAME } from "@/lib/session";
import { verifySessionToken } from "@/lib/session-token";

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;

  if (!secret) {
    throw new Error("SESSION_SECRET is required");
  }

  return secret;
}

export async function getServerSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  try {
    return verifySessionToken(token, { secret: getSessionSecret() });
  } catch {
    return null;
  }
}

export async function requireServerSession(): Promise<SessionUser> {
  const user = await getServerSession();

  if (!user) {
    redirect("/login");
  }

  return user;
}
