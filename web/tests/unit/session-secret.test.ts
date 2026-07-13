import { describe, expect, it } from "vitest";
import { getSessionSecret } from "@/lib/session-secret";

describe("session secret configuration", () => {
  it.each([undefined, "", "   "])("rejects a missing SESSION_SECRET", (secret) => {
    expect(() => getSessionSecret({ SESSION_SECRET: secret })).toThrow("SESSION_SECRET is not securely configured");
  });

  it.each([
    "replace-with-a-long-random-string",
    "YOUR_LONG_RANDOM_SESSION_SECRET",
    "change-me-to-a-long-random-secret"
  ])("rejects the known placeholder value %s", (secret) => {
    expect(() => getSessionSecret({ SESSION_SECRET: secret })).toThrow("SESSION_SECRET is not securely configured");
  });

  it("rejects secrets shorter than 32 characters", () => {
    expect(() => getSessionSecret({ SESSION_SECRET: "short-but-varied-session-secret" })).toThrow(
      "SESSION_SECRET is not securely configured"
    );
  });

  it("rejects secrets with obviously low character diversity", () => {
    expect(() => getSessionSecret({ SESSION_SECRET: "a".repeat(64) })).toThrow(
      "SESSION_SECRET is not securely configured"
    );
  });

  it("returns a valid secret unchanged", () => {
    const secret = "V4r!ed-session_secret-2026-07-13-xYz";

    expect(getSessionSecret({ SESSION_SECRET: secret })).toBe(secret);
  });

  it("does not include the rejected secret in its error", () => {
    const secret = "do-not-repeat-this-secret";

    expect(() => getSessionSecret({ SESSION_SECRET: secret })).toThrowError(
      expect.not.objectContaining({ message: expect.stringContaining(secret) })
    );
  });
});
