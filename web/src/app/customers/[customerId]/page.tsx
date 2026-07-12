import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { CustomerCard } from "@/components/customer-card";
import { CustomerEditForm } from "@/components/customer-edit-form";
import { isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requireServerSession } from "@/lib/session-server";

export const dynamic = "force-dynamic";

export default async function CustomerDetailPage({ params }: { params: Promise<{ customerId: string }> }) {
  const user = await requireServerSession();
  const { customerId } = await params;
  const customer = await prisma.company.findFirst({
    where: {
      id: customerId,
      isDelivered: true,
      grade: { in: ["A", "B"] },
      ...(isAdmin(user) ? {} : { ownerId: user.id })
    },
    include: {
      contacts: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
      evidences: { orderBy: { collectedAt: "desc" } },
      letters: { orderBy: { createdAt: "desc" } }
    }
  });

  if (!customer) {
    notFound();
  }

  return (
    <AppShell user={user}>
      <div className="page-heading row-heading">
        <div>
          <p className="eyebrow">客户详情</p>
          <h1>{customer.name}</h1>
          <p>查看来源证据、联系人、推荐产品和开发信，并维护跟进状态。</p>
        </div>
        <Link className="button button-secondary" href="/customers">
          <ArrowLeft aria-hidden="true" size={16} />
          返回客户库
        </Link>
      </div>

      <div className="detail-layout">
        <CustomerCard customer={customer} />
        <section className="edit-panel" aria-labelledby="edit-title">
          <h2 id="edit-title">跟进编辑</h2>
          <CustomerEditForm customerId={customer.id} initialNotes={customer.notes} initialStatus={customer.status} />
        </section>
      </div>
    </AppShell>
  );
}
