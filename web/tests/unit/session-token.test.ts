import { describe, expect, it } from "vitest";
import { signSessionToken, verifySessionToken } from "@/lib/session-token";

const secret = "test_secret_with_enough_entropy";
const payload = {
  id: "user_1",
  name: "Sales User",
  email: "sales@example.com",
  role: "sales" as const
};

describe("session tokens", () => {
  it("round-trips a signed HMAC session token", () => {
    const token = signSessionToken(payload, { secret, expiresInSeconds: 60, now: new Date("2026-07-12T00:00:00Z") });

    expect(verifySessionToken(token, { secret, now: new Date("2026-07-12T00:00:30Z") })).toEqual(payload);
  });

  it("uses cookie-safe token characters without percent escapes", () => {
    const token = signSessionToken(payload, { secret, expiresInSeconds: 60, now: new Date("2026-07-12T00:00:00Z") });

    expect(token).not.toContain("%");
  });

  it("rejects a tampered token", () => {
    const token = signSessionToken(payload, { secret, expiresInSeconds: 60, now: new Date("2026-07-12T00:00:00Z") });
    const tampered = `${token.slice(0, -1)}${token.endsWith("a") ? "b" : "a"}`;

    expect(verifySessionToken(tampered, { secret, now: new Date("2026-07-12T00:00:30Z") })).toBeNull();
  });

  it("rejects an expired token", () => {
    const token = signSessionToken(payload, { secret, expiresInSeconds: 60, now: new Date("2026-07-12T00:00:00Z") });

    expect(verifySessionToken(token, { secret, now: new Date("2026-07-12T00:01:01Z") })).toBeNull();
  });

  it("rejects a token at its exact expiration second", () => {
    const token = signSessionToken(payload, { secret, expiresInSeconds: 60, now: new Date("2026-07-12T00:00:00Z") });

    expect(verifySessionToken(token, { secret, now: new Date("2026-07-12T00:01:00Z") })).toBeNull();
  });
});
