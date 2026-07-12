import React from "react";
import { AlertTriangle, ExternalLink } from "lucide-react";

export type ContactTableContact = {
  id?: string;
  name: string;
  title: string;
  email: string;
  emailStatus: string;
  source: string;
  sourceUrl?: string | null;
  isPrimary?: boolean;
  riskNote?: string | null;
};

function emailStatusLabel(status: string): string {
  if (status === "accept_all") {
    return "accept-all 风险";
  }

  const labels: Record<string, string> = {
    valid: "已验证",
    risky: "风险",
    invalid: "无效",
    unknown: "未知"
  };

  return labels[status] ?? status;
}

export function ContactTable({ contacts }: { contacts: ContactTableContact[] }) {
  if (contacts.length === 0) {
    return <p className="empty-state">暂无合格联系人。</p>;
  }

  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            <th>联系人</th>
            <th>职位</th>
            <th>邮箱</th>
            <th>验证状态</th>
            <th>来源</th>
          </tr>
        </thead>
        <tbody>
          {contacts.map((contact) => {
            const risky = contact.emailStatus === "accept_all";

            return (
              <tr key={contact.id ?? `${contact.email}-${contact.name}`}>
                <td>
                  <span className="cell-title">{contact.name}</span>
                  {contact.isPrimary ? <span className="mini-badge">主联系人</span> : null}
                </td>
                <td>{contact.title}</td>
                <td>{contact.email}</td>
                <td>
                  <span className={risky ? "status-badge status-badge-risk" : "status-badge"}>
                    {risky ? <AlertTriangle aria-hidden="true" size={14} /> : null}
                    {emailStatusLabel(contact.emailStatus)}
                  </span>
                  {contact.riskNote ? <div className="muted small-text">{contact.riskNote}</div> : null}
                </td>
                <td>
                  {contact.sourceUrl ? (
                    <a className="inline-link" href={contact.sourceUrl} rel="noreferrer" target="_blank">
                      {contact.source}
                      <ExternalLink aria-hidden="true" size={13} />
                    </a>
                  ) : (
                    contact.source
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
