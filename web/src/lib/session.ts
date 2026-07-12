import type { SessionUser } from "@/lib/auth";
import { isAdmin } from "@/lib/auth";
import { signSessionToken, verifySessionToken } from "@/lib/session-token";

export const SESSION_COOKIE_NAME = "yonye_session";
const SESSION_TTL_SECONDS = 60 * 60 * 8;

export type OwnershipDecision = { allowed: true } | { allowed: false; status: 401 | 403 };

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;

  if (!secret) {
    throw new Error("SESSION_SECRET is required");
  }

  return secret;
}

export function createSessionToken(user: SessionUser): string {
  return signSessionToken(user, {
    secret: getSessionSecret(),
    expiresInSeconds: SESSION_TTL_SECONDS
  });
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS
  };
}

export function readCookie(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) {
    return null;
  }

  for (const part of cookieHeader.split(";")) {
    const [rawKey, ...rawValue] = part.trim().split("=");
    if (rawKey === name) {
      return rawValue.join("=") || null;
    }
  }

  return null;
}

export function getSessionFromRequest(request: Request): SessionUser | null {
  const token = readCookie(request.headers.get("cookie"), SESSION_COOKIE_NAME);

  if (!token) {
    return null;
  }

  try {
    return verifySessionToken(token, { secret: getSessionSecret() });
  } catch {
    return null;
  }
}

export function canAccessOwner(user: SessionUser, ownerId: string | null | undefined): boolean {
  return isAdmin(user) || (!!ownerId && user.id === ownerId);
}

export function ownershipDecision(user: SessionUser | null, ownerId: string | null | undefined): OwnershipDecision {
  if (!user) {
    return { allowed: false, status: 401 };
  }

  if (!canAccessOwner(user, ownerId)) {
    return { allowed: false, status: 403 };
  }

  return { allowed: true };
}
