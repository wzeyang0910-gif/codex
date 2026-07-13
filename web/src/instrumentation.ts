export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startTaskRecovery } = await import("@/server/tasks/recovery");
  startTaskRecovery();
}
