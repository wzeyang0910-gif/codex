"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Clock, Loader2, XCircle } from "lucide-react";
import { CustomerCard, type CustomerCardCustomer } from "@/components/customer-card";

type LeadTask = {
  id: string;
  status: string;
  targetRegion: string;
  targetCountries: string[];
  productKeys: string[];
  customerTypes: string[];
  language: string;
  extraKeywords: string[];
  targetCount: number;
  deliveredCount: number;
  searchedCount: number;
  rejectedCount: number;
  companies: CustomerCardCustomer[];
};

const terminalStatuses = new Set(["completed", "partial", "failed"]);

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    queued: "排队中",
    running: "运行中",
    partial: "部分完成",
    completed: "已完成",
    failed: "失败"
  };

  return labels[status] ?? status;
}

function StatusIcon({ status }: { status: string }) {
  if (status === "completed" || status === "partial") {
    return <CheckCircle2 aria-hidden="true" size={18} />;
  }

  if (status === "failed") {
    return <XCircle aria-hidden="true" size={18} />;
  }

  if (status === "running") {
    return <Loader2 aria-hidden="true" className="spin" size={18} />;
  }

  return <Clock aria-hidden="true" size={18} />;
}

export function TaskStatus({ taskId }: { taskId: string }) {
  const [task, setTask] = useState<LeadTask | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;

    async function load() {
      controller?.abort();
      controller = new AbortController();

      try {
        const response = await fetch(`/api/tasks/${taskId}`, { signal: controller.signal });
        const data = (await response.json().catch(() => ({}))) as { task?: LeadTask; error?: string };

        if (!active) {
          return;
        }

        if (!response.ok || !data.task) {
          setError(data.error ?? "任务读取失败");
          return;
        }

        setTask(data.task);
        setError("");

        if (!terminalStatuses.has(data.task.status)) {
          timer = setTimeout(load, 2500);
        }
      } catch (caught) {
        if (!active || (caught instanceof DOMException && caught.name === "AbortError")) {
          return;
        }

        setError("网络异常，稍后自动重试");
        timer = setTimeout(load, 4000);
      }
    }

    void load();

    return () => {
      active = false;
      controller?.abort();
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [taskId]);

  const deliveredCustomers = useMemo(
    () => task?.companies.filter((company) => company.grade !== "C" && company.grade !== "rejected") ?? [],
    [task]
  );

  if (!task && !error) {
    return <p className="loading-line">正在读取任务...</p>;
  }

  return (
    <section className="task-status" aria-live="polite">
      {error ? (
        <p className="error-line">
          <AlertCircle aria-hidden="true" size={16} />
          {error}
        </p>
      ) : null}

      {task ? (
        <>
          <div className="status-header">
            <div>
              <p className="eyebrow">任务编号 {task.id}</p>
              <h1>任务结果</h1>
            </div>
            <span className={`status-pill status-${task.status}`}>
              <StatusIcon status={task.status} />
              {statusLabel(task.status)}
            </span>
          </div>

          <div className="metric-grid" aria-label="任务统计">
            <div>
              <span>{task.searchedCount}</span>
              <p>已搜索</p>
            </div>
            <div>
              <span>{task.rejectedCount}</span>
              <p>已淘汰</p>
            </div>
            <div>
              <span>{deliveredCustomers.length}</span>
              <p>已交付 A/B</p>
            </div>
            <div>
              <span>{task.targetCount}</span>
              <p>目标交付</p>
            </div>
          </div>

          <dl className="criteria-list">
            <div>
              <dt>地区</dt>
              <dd>{task.targetRegion}</dd>
            </div>
            <div>
              <dt>国家/地区</dt>
              <dd>{task.targetCountries.join("、") || "未指定"}</dd>
            </div>
            <div>
              <dt>产品</dt>
              <dd>{task.productKeys.join("、")}</dd>
            </div>
            <div>
              <dt>客户类型</dt>
              <dd>{task.customerTypes.join("、")}</dd>
            </div>
            <div>
              <dt>语言</dt>
              <dd>{task.language}</dd>
            </div>
            <div>
              <dt>关键词</dt>
              <dd>{task.extraKeywords.join("、") || "无"}</dd>
            </div>
          </dl>

          <div className="customer-list">
            {deliveredCustomers.length > 0 ? (
              deliveredCustomers.map((customer) => <CustomerCard customer={customer} key={customer.id} />)
            ) : (
              <p className="empty-state">还没有交付客户。任务运行时会自动刷新。</p>
            )}
          </div>
        </>
      ) : null}
    </section>
  );
}
