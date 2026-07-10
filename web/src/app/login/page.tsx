"use client";

import { FormEvent, useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("sales@cnyonye.local");
  const [password, setPassword] = useState("123456");
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("正在登录...");

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    const data = (await response.json()) as {
      user?: { name: string; role: string };
      error?: string;
    };

    if (!response.ok) {
      setMessage(data.error ?? "登录失败");
      return;
    }

    setMessage(`欢迎，${data.user?.name ?? "用户"}（${data.user?.role ?? ""}）`);
  }

  return (
    <main className="login-page">
      <section className="login-panel" aria-labelledby="login-title">
        <div>
          <p className="login-eyebrow">常州原研医疗内部系统</p>
          <h1 id="login-title">内部获客平台登录</h1>
          <p className="login-copy">
            仅供公司内部管理员和业务员使用。本地种子账号可直接用于验证 MVP 流程。
          </p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <label>
            邮箱
            <input
              autoComplete="email"
              name="email"
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              value={email}
            />
          </label>

          <label>
            密码
            <input
              autoComplete="current-password"
              name="password"
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              value={password}
            />
          </label>

          <button type="submit">登录</button>
          {message ? <p className="login-message">{message}</p> : null}
        </form>

        <div className="login-seeds" aria-label="本地种子账号">
          <strong>本地种子账号</strong>
          <span>admin@cnyonye.local / 123456</span>
          <span>sales@cnyonye.local / 123456</span>
        </div>
      </section>
    </main>
  );
}
