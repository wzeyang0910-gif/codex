import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "@/components/app-shell";

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  loadAdminMetrics: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  })
}));

vi.mock("@/lib/session-server", () => ({ getServerSession: mocks.getServerSession }));
vi.mock("@/lib/admin-metrics-server", () => ({ loadAdminMetrics: mocks.loadAdminMetrics }));
vi.mock("next/navigation", async () => {
  const actual = await vi.importActual<typeof import("next/navigation")>("next/navigation");
  return { ...actual, redirect: mocks.redirect };
});

import AdminPage from "@/app/admin/page";

const admin = { id: "admin_1", name: "管理员", email: "admin@example.com", role: "admin" as const };
const sales = { id: "sales_1", name: "业务员", email: "sales@example.com", role: "sales" as const };
const metrics = {
  taskCount: 3,
  taskStatusCounts: { queued: 1, running: 0, partial: 0, completed: 2, failed: 0 },
  deliveredCount: 5,
  rejectedCount: 4,
  validCustomerRate: "55.6%",
  failedApiCalls: 1,
  apiCreditsUsed: 18,
  averageCreditsPerDeliveredCustomer: "3.60",
  providerUsage: [{ provider: "Prospeo", calls: 4, creditsUsed: 14, failedCalls: 1 }],
  apiConfiguration: [
    { provider: "Prospeo", configured: true },
    { provider: "Hunter", configured: false },
    { provider: "Apify", configured: true },
    { provider: "ContactOut", configured: false }
  ],
  alerts: ["存在 1 次接口失败，需要检查供应商或余额"]
};

describe("admin page authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects a missing session to login before loading metrics", async () => {
    mocks.getServerSession.mockResolvedValue(null);

    await expect(AdminPage()).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(mocks.loadAdminMetrics).not.toHaveBeenCalled();
  });

  it("shows a forbidden state to sales without loading metrics", async () => {
    mocks.getServerSession.mockResolvedValue(sales);

    render(await AdminPage());

    expect(screen.getByRole("heading", { name: "权限不足" })).toBeInTheDocument();
    expect(screen.queryByText("接口总积分")).not.toBeInTheDocument();
    expect(mocks.loadAdminMetrics).not.toHaveBeenCalled();
  });

  it("renders real metrics and configuration states for an administrator", async () => {
    mocks.getServerSession.mockResolvedValue(admin);
    mocks.loadAdminMetrics.mockResolvedValue(metrics);

    render(await AdminPage());

    expect(screen.getByRole("heading", { name: "管理员监控" })).toBeInTheDocument();
    expect(screen.getByText("55.6%")).toBeInTheDocument();
    expect(screen.getByText("18")).toBeInTheDocument();
    expect(screen.getByText("存在 1 次接口失败，需要检查供应商或余额")).toBeInTheDocument();
    expect(screen.getByRole("row", { name: /Prospeo 4 14 1/ })).toBeInTheDocument();
    expect(screen.getAllByText("未配置", { selector: "span" })).toHaveLength(2);
  });
});

describe("administrator navigation", () => {
  it("shows the admin link only to administrators", () => {
    const { rerender } = render(
      <AppShell user={sales}>
        <p>内容</p>
      </AppShell>
    );

    expect(screen.queryByRole("link", { name: "管理员监控" })).not.toBeInTheDocument();

    rerender(
      <AppShell user={admin}>
        <p>内容</p>
      </AppShell>
    );

    expect(screen.getByRole("link", { name: "管理员监控" })).toHaveAttribute("href", "/admin");
  });
});
