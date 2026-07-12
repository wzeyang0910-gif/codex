import { act, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TaskStatus } from "@/components/task-status";

const baseCompany = {
  id: "company-a",
  name: "已交付 A 类客户",
  country: "沙特阿拉伯",
  customerType: "distributor",
  businessSummary: "业务匹配",
  demandEvidence: "需求证据",
  recommendedProducts: ["肌内效贴"],
  grade: "A",
  score: 90,
  contacts: []
};

function taskResponse(companies = [{ ...baseCompany, isDelivered: true }], status = "completed") {
  return new Response(
    JSON.stringify({
      task: {
        id: "task-1",
        status,
        targetRegion: "Middle East",
        targetCountries: ["Saudi Arabia"],
        productKeys: ["kinesiology_tape"],
        customerTypes: ["distributor"],
        language: "English",
        extraKeywords: [],
        targetCount: 5,
        deliveredCount: companies.filter((company) => company.isDelivered).length,
        searchedCount: companies.length,
        rejectedCount: 0,
        companies
      }
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

async function flushRequests() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
}

describe("TaskStatus", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([500, 502, 503, 408, 429])("收到可恢复 HTTP %s 后显示重试状态并继续轮询", async (status) => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "服务暂时不可用" }), {
          status,
          headers: { "Content-Type": "application/json" }
        })
      )
      .mockResolvedValueOnce(taskResponse());
    vi.stubGlobal("fetch", fetchMock);

    render(<TaskStatus taskId="task-1" />);
    await flushRequests();

    expect(screen.getByText(/服务暂时不可用.*自动重试/)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(screen.getByText("已完成")).toBeInTheDocument();
  });

  it.each([
    [401, "请先登录"],
    [403, "无权访问该任务"],
    [404, "任务不存在"]
  ])("收到永久 HTTP %s 后显示错误并停止轮询", async (status, message) => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: message }), {
        status,
        headers: { "Content-Type": "application/json" }
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<TaskStatus taskId="task-1" />);
    await flushRequests();

    expect(screen.getByText(message)).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("只展示已交付的 A/B 类客户", async () => {
    const companies = [
      { ...baseCompany, id: "delivered-a", name: "已交付 A 类客户", grade: "A", isDelivered: true },
      { ...baseCompany, id: "delivered-b", name: "已交付 B 类客户", grade: "B", isDelivered: true },
      { ...baseCompany, id: "pending-a", name: "未交付 A 类客户", grade: "A", isDelivered: false },
      { ...baseCompany, id: "delivered-c", name: "已交付 C 类客户", grade: "C", isDelivered: true },
      { ...baseCompany, id: "delivered-d", name: "已交付 D 类客户", grade: "D", isDelivered: true }
    ];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(taskResponse(companies)));

    render(<TaskStatus taskId="task-1" />);
    await flushRequests();

    expect(screen.getByText("已交付 A 类客户")).toBeInTheDocument();
    expect(screen.getByText("已交付 B 类客户")).toBeInTheDocument();
    expect(screen.queryByText("未交付 A 类客户")).not.toBeInTheDocument();
    expect(screen.queryByText("已交付 C 类客户")).not.toBeInTheDocument();
    expect(screen.queryByText("已交付 D 类客户")).not.toBeInTheDocument();
    expect(screen.getByText("已交付 A/B").previousElementSibling).toHaveTextContent("2");
  });
});
