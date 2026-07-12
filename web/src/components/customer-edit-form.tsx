"use client";

import React, { FormEvent, useState } from "react";
import { Save } from "lucide-react";

const statusOptions = [
  { value: "not_contacted", label: "未联系" },
  { value: "sent", label: "已发送" },
  { value: "replied", label: "已回复" },
  { value: "quoted", label: "已报价" },
  { value: "won", label: "已成交" },
  { value: "not_interested", label: "暂不感兴趣" }
];

export function CustomerEditForm({
  customerId,
  initialNotes,
  initialStatus
}: {
  customerId: string;
  initialNotes: string;
  initialStatus: string;
}) {
  const [notes, setNotes] = useState(initialNotes);
  const [status, setStatus] = useState(initialStatus);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("正在保存...");

    try {
      const response = await fetch(`/api/customers/${customerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes, status })
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        setMessage(data.error ?? "保存失败");
        setSaving(false);
        return;
      }

      setMessage("已保存");
    } catch {
      setMessage("网络异常，请稍后重试");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="edit-form" onSubmit={handleSubmit}>
      <label>
        跟进状态
        <select disabled={saving} name="status" onChange={(event) => setStatus(event.target.value)} value={status}>
          {statusOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        跟进备注
        <textarea disabled={saving} name="notes" onChange={(event) => setNotes(event.target.value)} rows={5} value={notes} />
      </label>
      <div className="form-actions">
        <button className="button" disabled={saving} type="submit">
          <Save aria-hidden="true" size={16} />
          保存编辑
        </button>
        {message ? <p className="form-message" role="status">{message}</p> : null}
      </div>
    </form>
  );
}
