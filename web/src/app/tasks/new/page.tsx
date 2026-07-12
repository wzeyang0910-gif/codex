import { AppShell } from "@/components/app-shell";
import { TaskForm } from "@/components/task-form";
import { yonyeProducts } from "@/lib/products";
import { requireServerSession } from "@/lib/session-server";

export const dynamic = "force-dynamic";

export default async function NewTaskPage() {
  const user = await requireServerSession();

  return (
    <AppShell user={user}>
      <div className="page-heading">
        <p className="eyebrow">获客任务</p>
        <h1>创建任务</h1>
        <p>选择目标市场、产品和客户类型后，系统会启动受额度保护的搜索流程。</p>
      </div>
      <TaskForm products={yonyeProducts} />
    </AppShell>
  );
}
