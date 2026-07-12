import React from "react";
import Link from "next/link";
import { Edit3, ExternalLink, Mail, MapPin, ShieldAlert } from "lucide-react";
import { ContactTable, type ContactTableContact } from "@/components/contact-table";

export type CustomerCardEvidence = {
  id?: string;
  type: string;
  title: string;
  url?: string | null;
  summary: string;
};

export type CustomerCardLetter = {
  id?: string;
  subject: string;
  body: string;
};

export type CustomerCardCustomer = {
  id: string;
  name: string;
  country: string;
  region?: string;
  city?: string | null;
  website?: string | null;
  customerType: string;
  businessSummary: string;
  demandEvidence: string;
  recommendedProducts: string[];
  grade: string;
  score: number;
  status?: string;
  contacts: ContactTableContact[];
  evidences?: CustomerCardEvidence[];
  letters?: CustomerCardLetter[];
};

function gradeClass(grade: string): string {
  if (grade === "A") {
    return "grade-badge grade-a";
  }

  if (grade === "B") {
    return "grade-badge grade-b";
  }

  return "grade-badge";
}

export function CustomerCard({ customer }: { customer: CustomerCardCustomer }) {
  const hasAcceptAll = customer.contacts.some((contact) => contact.emailStatus === "accept_all");
  const primaryLetter = customer.letters?.[0];
  const location = [customer.city, customer.country].filter(Boolean).join(", ");

  return (
    <article className="customer-card" aria-labelledby={`customer-${customer.id}`}>
      <header className="customer-card-header">
        <div>
          <h2 id={`customer-${customer.id}`}>{customer.name}</h2>
          <p className="muted meta-line">
            <MapPin aria-hidden="true" size={14} />
            {location || customer.region || "地区未记录"} · {customer.customerType}
          </p>
        </div>
        <div className="score-box" aria-label={`等级 ${customer.grade}，评分 ${customer.score} 分`}>
          <span className={gradeClass(customer.grade)}>{customer.grade}</span>
          <span>{customer.score} 分</span>
        </div>
      </header>

      <div className="info-grid">
        <section aria-label="业务匹配">
          <h3>业务匹配</h3>
          <p>{customer.businessSummary}</p>
        </section>
        <section aria-label="需求证据">
          <h3>需求证据</h3>
          <p>{customer.demandEvidence}</p>
        </section>
        <section aria-label="推荐产品">
          <h3>推荐产品</h3>
          <p>{customer.recommendedProducts.join("、")}</p>
        </section>
      </div>

      {hasAcceptAll ? (
        <p className="risk-note">
          <ShieldAlert aria-hidden="true" size={15} />
          存在全收邮箱风险，按 B 类客户处理，外联前请二次确认。
        </p>
      ) : null}

      <section className="card-section" aria-label="联系人">
        <h3>
          <Mail aria-hidden="true" size={15} />
          合格联系人
        </h3>
        <ContactTable contacts={customer.contacts} />
      </section>

      {customer.evidences && customer.evidences.length > 0 ? (
        <section className="card-section" aria-label="来源证据">
          <h3>来源证据</h3>
          <ul className="evidence-list">
            {customer.evidences.map((evidence) => (
              <li key={evidence.id ?? evidence.title}>
                {evidence.url ? (
                  <a className="inline-link" href={evidence.url} rel="noreferrer" target="_blank">
                    {evidence.title}
                    <ExternalLink aria-hidden="true" size={13} />
                  </a>
                ) : (
                  <span className="cell-title">{evidence.title}</span>
                )}
                <span className="muted">{evidence.summary}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {primaryLetter ? (
        <section className="card-section" aria-label="开发信">
          <h3>开发信</h3>
          <p className="letter-subject">{primaryLetter.subject}</p>
          <p className="letter-body">{primaryLetter.body}</p>
        </section>
      ) : null}

      <footer className="card-actions">
        <Link className="button button-secondary" href={`/customers/${customer.id}`}>
          <Edit3 aria-hidden="true" size={16} />
          编辑客户
        </Link>
      </footer>
    </article>
  );
}
