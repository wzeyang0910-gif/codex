"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { LogIn } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage("正在登录...");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });

      let data: {
        user?: { name: string; role: string };
        error?: string;
      };

      try {
        data = (await response.json()) as typeof data;
      } catch {
        setMessage("服务器响应格式异常，请稍后重试");
        return;
      }

      if (!response.ok) {
        setMessage(data.error ?? "登录失败");
        return;
      }

      setMessage(`欢迎，${data.user?.name ?? "用户"}。正在进入任务创建页...`);
      router.replace("/tasks/new");
    } catch {
      setMessage("网络异常，请稍后重试");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-panel" aria-labelledby="login-title">
        <div>
          <p className="login-eyebrow">常州原研医疗内部系统</p>
          <h1 id="login-title">内部获客平台登录</h1>
          <p className="login-copy">仅供公司内部管理员和业务员使用。登录后可创建获客任务、查看结果并维护客户跟进。</p>
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

          <button className="button" disabled={isSubmitting} type="submit">
            <LogIn aria-hidden="true" size={16} />
            登录
          </button>
          {message ? (
            <p aria-live="polite" className="login-message" role="status">
              {message}
            </p>
          ) : null}
        </form>

        <p className="login-seeds">请联系管理员获取账号</p>
      </section>
    </main>
  );
}
