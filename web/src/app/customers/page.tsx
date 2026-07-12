import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { CustomerCard } from "@/components/customer-card";
import { isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requireServerSession } from "@/lib/session-server";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const user = await requireServerSession();
  const customers = await prisma.company.findMany({
    where: {
      isDelivered: true,
      grade: { in: ["A", "B"] },
      ...(isAdmin(user) ? {} : { ownerId: user.id })
    },
    include: {
      contacts: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
      evidences: { orderBy: { collectedAt: "desc" } },
      letters: { orderBy: { createdAt: "desc" } }
    },
    orderBy: [{ deliveredAt: "desc" }, { updatedAt: "desc" }],
    take: 50
  });

  return (
    <AppShell user={user}>
      <div className="page-heading row-heading">
        <div>
          <p className="eyebrow">客户库</p>
          <h1>{isAdmin(user) ? "全部已交付客户" : "我的已交付客户"}</h1>
          <p>仅显示 A/B 客户；C 类和淘汰客户不会进入交付列表。</p>
        </div>
        <Link className="button button-secondary" href="/tasks/new">
          创建新任务
        </Link>
      </div>

      <div className="customer-list">
        {customers.length > 0 ? (
          customers.map((customer) => <CustomerCard customer={customer} key={customer.id} />)
        ) : (
          <p className="empty-state">暂无已交付客户。</p>
        )}
      </div>
    </AppShell>
  );
}
