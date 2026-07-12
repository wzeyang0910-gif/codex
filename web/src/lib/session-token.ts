import { createHmac, timingSafeEqual } from "node:crypto";
import type { SessionUser } from "@/lib/auth";

type SignedSessionPayload = SessionUser & {
  exp: number;
};

export type SignSessionTokenOptions = {
  secret: string;
  expiresInSeconds: number;
  now?: Date;
};

export type VerifySessionTokenOptions = {
  secret: string;
  now?: Date;
};

function base64Url(buffer: Buffer): string {
  return buffer.toString("base64url");
}

function signPayload(payloadPart: string, secret: string): string {
  return base64Url(createHmac("sha256", secret).update(payloadPart).digest());
}

function encodePayload(payload: SignedSessionPayload): string {
  return base64Url(Buffer.from(JSON.stringify(payload), "utf8"));
}

function decodePayload(payloadPart: string): SignedSessionPayload {
  return JSON.parse(Buffer.from(payloadPart, "base64url").toString("utf8")) as SignedSessionPayload;
}

function safeCompare(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function signSessionToken(user: SessionUser, options: SignSessionTokenOptions): string {
  const issuedAt = options.now ?? new Date();
  const payload: SignedSessionPayload = {
    ...user,
    exp: Math.floor(issuedAt.getTime() / 1000) + options.expiresInSeconds
  };
  const payloadPart = encodePayload(payload);
  const signature = signPayload(payloadPart, options.secret);

  return `${payloadPart}.${signature}`;
}

export function verifySessionToken(token: string, options: VerifySessionTokenOptions): SessionUser | null {
  const [payloadPart, signature, extra] = token.split(".");

  if (!payloadPart || !signature || extra !== undefined) {
    return null;
  }

  const expectedSignature = signPayload(payloadPart, options.secret);
  if (!safeCompare(signature, expectedSignature)) {
    return null;
  }

  try {
    const payload = decodePayload(payloadPart) as Partial<SignedSessionPayload>;
    const nowSeconds = Math.floor((options.now ?? new Date()).getTime() / 1000);

    if (
      typeof payload.id !== "string" ||
      typeof payload.name !== "string" ||
      typeof payload.email !== "string" ||
      (payload.role !== "admin" && payload.role !== "sales") ||
      typeof payload.exp !== "number" ||
      payload.exp <= nowSeconds
    ) {
      return null;
    }

    return {
      id: payload.id,
      name: payload.name,
      email: payload.email,
      role: payload.role
    };
  } catch {
    return null;
  }
}
