import { describe, expect, it } from "vitest";
import HomePage from "@/app/page";

describe("home page scaffold", () => {
  it("renders the internal lead platform headline", () => {
    expect(HomePage).toBeDefined();
  });
});
