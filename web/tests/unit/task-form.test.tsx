import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TaskForm } from "@/components/task-form";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push })
}));

const products = [
  { key: "kinesiology_tape", zhName: "肌内效贴系列", enName: "Kinesiology Tape Series" },
  { key: "wound_dressing", zhName: "敷料贴系列", enName: "Wound Dressing Series" }
];

describe("TaskForm", () => {
  beforeEach(() => {
    push.mockReset();
    vi.unstubAllGlobals();
  });

  it("posts the exact task payload, disables while submitting, and routes to the result page", async () => {
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          setTimeout(
            () =>
              resolve(
                new Response(JSON.stringify({ taskId: "task_123", status: "queued", remaining: 25 }), {
                  status: 200,
                  headers: { "Content-Type": "application/json" }
                })
              ),
            10
          );
        })
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<TaskForm products={products} />);

    fireEvent.change(screen.getByLabelText("目标地区"), { target: { value: "Middle East" } });
    fireEvent.change(screen.getByLabelText("目标国家/地区"), { target: { value: "Saudi Arabia, UAE" } });
    fireEvent.click(screen.getByLabelText("Kinesiology Tape Series"));
    fireEvent.click(screen.getByLabelText("经销商"));
    fireEvent.change(screen.getByLabelText("附加关键词"), { target: { value: "wound care" } });

    const submit = screen.getByRole("button", { name: "开始搜索" });
    fireEvent.click(submit);

    expect(submit).toBeDisabled();

    await waitFor(() => expect(push).toHaveBeenCalledWith("/tasks/task_123"));
    expect(fetchMock).toHaveBeenCalledWith("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        targetRegion: "Middle East",
        targetCountries: ["Saudi Arabia", "UAE"],
        productKeys: ["kinesiology_tape"],
        customerTypes: ["distributor"],
        language: "English",
        extraKeywords: ["wound care"]
      })
    });
  });

  it.each([
    [400, "任务参数不完整"],
    [401, "请先登录"],
    [409, "任务创建冲突，请稍后重试"],
    [429, "今日额度已用完"]
  ])("shows API error message for %s responses", async (status, message) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: message }), { status, headers: { "Content-Type": "application/json" } }))
    );

    render(<TaskForm products={products} />);
    fireEvent.click(screen.getByLabelText("Kinesiology Tape Series"));
    fireEvent.click(screen.getByLabelText("经销商"));
    fireEvent.click(screen.getByRole("button", { name: "开始搜索" }));

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("shows a network error without navigating", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      })
    );

    render(<TaskForm products={products} />);
    fireEvent.click(screen.getByLabelText("Kinesiology Tape Series"));
    fireEvent.click(screen.getByLabelText("经销商"));
    fireEvent.click(screen.getByRole("button", { name: "开始搜索" }));

    expect(await screen.findByText("网络异常，请稍后重试")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });
});
