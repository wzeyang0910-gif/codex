import Link from "next/link";
import { CircleOff } from "lucide-react";

export default function ForbiddenPage() {
  return (
    <main className="login-page">
      <section className="permission-state" aria-labelledby="permission-title">
        <CircleOff aria-hidden="true" size={22} />
        <div>
          <h1 id="permission-title">权限不足</h1>
          <p>管理员监控仅对管理员开放。</p>
          <Link className="button button-secondary" href="/tasks/new">
            返回任务页
          </Link>
        </div>
      </section>
    </main>
  );
}
