import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";

describe("production response headers", () => {
  it("sets baseline browser security headers for every route", async () => {
    const entries = await nextConfig.headers?.();
    const globalHeaders = entries?.find((entry) => entry.source === "/(.*)")?.headers ?? [];

    expect(nextConfig.poweredByHeader).toBe(false);
    expect(globalHeaders).toEqual(expect.arrayContaining([
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" }
    ]));
  });
});
