import React from "react";
import Link from "next/link";
import { LogOut, Users, ClipboardList, PlusCircle } from "lucide-react";
import type { SessionUser } from "@/lib/auth";

export function AppShell({ children, user }: { children: React.ReactNode; user: SessionUser }) {
  return (
    <div className="app-shell">
      <header className="topbar">
        <Link className="brand" href="/tasks/new">
          原研获客
        </Link>
        <nav aria-label="主导航">
          <Link href="/tasks/new">
            <PlusCircle aria-hidden="true" size={16} />
            新任务
          </Link>
          <Link href="/customers">
            <Users aria-hidden="true" size={16} />
            客户库
          </Link>
          <span className="nav-user" title={user.email}>
            <ClipboardList aria-hidden="true" size={16} />
            {user.name} · {user.role === "admin" ? "管理员" : "业务员"}
          </span>
        </nav>
        <form action="/api/auth/logout" method="post">
          <button className="icon-button" title="退出登录" aria-label="退出登录" type="submit">
            <LogOut aria-hidden="true" size={17} />
          </button>
        </form>
      </header>
      <main className="page-content">{children}</main>
    </div>
  );
}
