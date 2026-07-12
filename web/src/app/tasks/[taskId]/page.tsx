import { AppShell } from "@/components/app-shell";
import { TaskStatus } from "@/components/task-status";
import { requireServerSession } from "@/lib/session-server";

export const dynamic = "force-dynamic";

export default async function TaskResultPage({ params }: { params: Promise<{ taskId: string }> }) {
  const user = await requireServerSession();
  const { taskId } = await params;

  return (
    <AppShell user={user}>
      <TaskStatus taskId={taskId} />
    </AppShell>
  );
}
