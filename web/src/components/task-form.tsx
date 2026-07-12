"use client";

import React, { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Play, Search } from "lucide-react";

type TaskProduct = {
  key: string;
  zhName: string;
  enName: string;
};

const customerTypeOptions = [
  { value: "distributor", label: "经销商" },
  { value: "wholesaler", label: "批发商" },
  { value: "hospital_supplier", label: "医院供应商" },
  { value: "ecommerce", label: "电商卖家" },
  { value: "brand", label: "品牌方" }
];

function splitList(value: string): string[] {
  return value
    .split(/[\n,，]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function TaskForm({ products }: { products: TaskProduct[] }) {
  const router = useRouter();
  const [targetRegion, setTargetRegion] = useState("Middle East");
  const [targetCountries, setTargetCountries] = useState("Saudi Arabia");
  const [language, setLanguage] = useState("English");
  const [extraKeywords, setExtraKeywords] = useState("");
  const [productKeys, setProductKeys] = useState<string[]>([]);
  const [customerTypes, setCustomerTypes] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  function toggleValue(current: string[], value: string): string[] {
    return current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage("正在创建任务...");

    const payload = {
      targetRegion: targetRegion.trim(),
      targetCountries: splitList(targetCountries),
      productKeys,
      customerTypes,
      language,
      extraKeywords: splitList(extraKeywords)
    };

    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = (await response.json().catch(() => ({}))) as { taskId?: string; error?: string };

      if (!response.ok) {
        setMessage(data.error ?? "任务创建失败");
        setSubmitting(false);
        return;
      }

      if (!data.taskId) {
        setMessage("任务创建成功，但未返回任务编号");
        setSubmitting(false);
        return;
      }

      router.push(`/tasks/${data.taskId}`);
    } catch {
      setMessage("网络异常，请稍后重试");
      setSubmitting(false);
    }
  }

  return (
    <form className="task-form" onSubmit={handleSubmit}>
      <div className="form-banner">
        <Search aria-hidden="true" size={18} />
        <span>每次任务交付 5 家有效客户；每人每天最多 30 家。</span>
      </div>

      <fieldset disabled={submitting}>
        <div className="form-grid">
          <label>
            目标地区
            <input name="targetRegion" onChange={(event) => setTargetRegion(event.target.value)} value={targetRegion} />
          </label>
          <label>
            目标国家/地区
            <textarea
              name="targetCountries"
              onChange={(event) => setTargetCountries(event.target.value)}
              rows={3}
              value={targetCountries}
            />
          </label>
          <label>
            语言
            <select name="language" onChange={(event) => setLanguage(event.target.value)} value={language}>
              <option value="English">English</option>
              <option value="Arabic">Arabic</option>
              <option value="Spanish">Spanish</option>
              <option value="Chinese">Chinese</option>
            </select>
          </label>
          <label>
            附加关键词
            <textarea
              name="extraKeywords"
              onChange={(event) => setExtraKeywords(event.target.value)}
              placeholder="可用逗号或换行分隔"
              rows={3}
              value={extraKeywords}
            />
          </label>
        </div>

        <section className="choice-section" aria-labelledby="products-title">
          <h2 id="products-title">产品</h2>
          <div className="choice-grid">
            {products.map((product) => (
              <label className="check-row" key={product.key}>
                <input
                  aria-label={product.enName}
                  checked={productKeys.includes(product.key)}
                  name="productKeys"
                  onChange={() => setProductKeys((current) => toggleValue(current, product.key))}
                  type="checkbox"
                  value={product.key}
                />
                <span>
                  <strong>{product.enName}</strong>
                  <small>{product.zhName}</small>
                </span>
              </label>
            ))}
          </div>
        </section>

        <section className="choice-section" aria-labelledby="types-title">
          <h2 id="types-title">客户类型</h2>
          <div className="choice-grid">
            {customerTypeOptions.map((option) => (
              <label className="check-row" key={option.value}>
                <input
                  aria-label={option.label}
                  checked={customerTypes.includes(option.value)}
                  name="customerTypes"
                  onChange={() => setCustomerTypes((current) => toggleValue(current, option.value))}
                  type="checkbox"
                  value={option.value}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </section>

        <div className="form-actions">
          <button className="button" disabled={submitting} type="submit">
            <Play aria-hidden="true" size={16} />
            {submitting ? "创建中..." : "开始搜索"}
          </button>
          {message ? <p className="form-message" role="status">{message}</p> : null}
        </div>
      </fieldset>
    </form>
  );
}
