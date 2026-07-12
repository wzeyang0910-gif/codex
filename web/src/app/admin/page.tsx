import React from "react";
import { AlertTriangle, CheckCircle2, CircleOff } from "lucide-react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { adminAccessDecision, type AdminTaskStatus } from "@/lib/admin-metrics";
import { loadAdminMetrics } from "@/lib/admin-metrics-server";
import { getServerSession } from "@/lib/session-server";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<AdminTaskStatus, string> = {
  queued: "排队中",
  running: "执行中",
  partial: "部分完成",
  completed: "已完成",
  failed: "失败"
};

export default async function AdminPage() {
  const user = await getServerSession();
  const access = adminAccessDecision(user);

  if (!access.allowed) {
    if (access.status === 401 || !user) {
      redirect("/login");
    }

    return (
      <AppShell user={user}>
        <section className="permission-state" aria-labelledby="permission-title">
          <CircleOff aria-hidden="true" size={22} />
          <div>
            <h1 id="permission-title">权限不足</h1>
            <p>管理员监控仅对管理员开放。</p>
          </div>
        </section>
      </AppShell>
    );
  }

  if (!user) {
    redirect("/login");
  }

  const metrics = await loadAdminMetrics();

  return (
    <AppShell user={user}>
      <div className="page-heading">
        <p className="eyebrow">运营概览</p>
        <h1>管理员监控</h1>
        <p>汇总任务交付质量、供应商调用消耗与接口异常。</p>
      </div>

      {metrics.alerts.length > 0 ? (
        <div className="admin-alerts" aria-label="接口告警">
          {metrics.alerts.map((alert) => (
            <p className="risk-note" key={alert}>
              <AlertTriangle aria-hidden="true" size={16} />
              {alert}
            </p>
          ))}
        </div>
      ) : null}

      <section className="admin-section" aria-labelledby="quality-title">
        <div className="section-heading">
          <div>
            <h2 id="quality-title">任务与交付质量</h2>
            <p>有效率按交付客户数除以交付与淘汰候选总数计算。</p>
          </div>
        </div>
        <div className="metric-grid admin-metric-grid">
          <div><span>{metrics.taskCount}</span><p>任务总数</p></div>
          <div><span>{metrics.deliveredCount}</span><p>交付客户</p></div>
          <div><span>{metrics.rejectedCount}</span><p>淘汰候选</p></div>
          <div><span>{metrics.validCustomerRate}</span><p>有效率</p></div>
          <div><span>{metrics.failedApiCalls}</span><p>API 失败</p></div>
          <div><span>{metrics.apiCreditsUsed}</span><p>接口总积分</p></div>
          <div><span>{metrics.averageCreditsPerDeliveredCustomer}</span><p>每个交付客户平均积分</p></div>
        </div>

        <div className="table-scroll compact-table-scroll">
          <table className="data-table compact-table">
            <thead><tr><th>任务状态</th><th>数量</th></tr></thead>
            <tbody>
              {Object.entries(metrics.taskStatusCounts).map(([status, count]) => (
                <tr key={status}><td>{STATUS_LABELS[status as AdminTaskStatus]}</td><td>{count}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin-section" aria-labelledby="provider-title">
        <div className="section-heading">
          <div>
            <h2 id="provider-title">供应商调用</h2>
            <p>积分来自已记录调用，不表示供应商账户实时余额。</p>
          </div>
        </div>
        <div className="table-scroll">
          <table className="data-table compact-table">
            <thead><tr><th>供应商</th><th>调用次数</th><th>积分</th><th>失败</th></tr></thead>
            <tbody>
              {metrics.providerUsage.length > 0 ? metrics.providerUsage.map((provider) => (
                <tr key={provider.provider}>
                  <td className="cell-title">{provider.provider}</td>
                  <td>{provider.calls}</td>
                  <td>{provider.creditsUsed}</td>
                  <td>{provider.failedCalls}</td>
                </tr>
              )) : (
                <tr><td className="muted" colSpan={4}>暂无接口调用记录</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin-section" aria-labelledby="config-title">
        <div className="section-heading">
          <div>
            <h2 id="config-title">API 配置</h2>
            <p>仅显示环境配置是否存在，不展示密钥内容。</p>
          </div>
        </div>
        <div className="api-config-list">
          {metrics.apiConfiguration.map((provider) => (
            <div key={provider.provider}>
              <strong>{provider.provider}</strong>
              <span className={provider.configured ? "config-state configured" : "config-state not-configured"}>
                {provider.configured ? <CheckCircle2 aria-hidden="true" size={14} /> : <CircleOff aria-hidden="true" size={14} />}
                {provider.configured ? "已配置" : "未配置"}
              </span>
            </div>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
