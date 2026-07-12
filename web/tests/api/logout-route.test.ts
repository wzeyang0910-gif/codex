import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/auth/logout/route";

describe("logout route", () => {
  it("clears the session and redirects a form POST to login with GET semantics", async () => {
    const response = await POST(new Request("http://localhost/api/auth/logout", { method: "POST" }));

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("http://localhost/login");
    expect(response.headers.get("set-cookie")).toContain("yonye_session=");
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  });
});
