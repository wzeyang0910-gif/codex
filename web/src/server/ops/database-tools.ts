import path from "node:path";

const BACKUP_PATTERN = /^yonye_leads_\d{8}_\d{6}\.dump$/;

export function buildPostgresConnection(databaseUrl: string) {
  let url: URL;
  try {
    url = new URL(databaseUrl);
  } catch {
    throw new Error("DATABASE_URL must be a valid PostgreSQL URL");
  }

  if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") {
    throw new Error("DATABASE_URL must use PostgreSQL");
  }

  const databaseName = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (!databaseName) throw new Error("DATABASE_URL must include a database name");

  return {
    args: [
      "--host", url.hostname,
      "--port", url.port || "5432",
      "--username", decodeURIComponent(url.username),
      "--dbname", databaseName
    ],
    password: decodeURIComponent(url.password)
  };
}

export function backupFileName(date: Date): string {
  const stamp = date.toISOString()
    .replace(/[-:]/g, "")
    .replace("T", "_")
    .slice(0, 15);
  return `yonye_leads_${stamp}.dump`;
}

export function shouldDeleteBackup(
  fileName: string,
  modifiedAt: Date,
  now: Date,
  retentionDays: number
): boolean {
  if (!BACKUP_PATTERN.test(fileName)) return false;
  return now.getTime() - modifiedAt.getTime() > retentionDays * 24 * 60 * 60 * 1000;
}

export function resolvePostgresTool(
  tool: "pg_dump" | "pg_restore",
  environment: Record<string, string | undefined> = process.env,
  exists: (filePath: string) => boolean,
  platform = process.platform
): string {
  const executable = platform === "win32" ? `${tool}.exe` : tool;
  const candidates = [
    environment.POSTGRES_BIN ? path.join(environment.POSTGRES_BIN, executable) : "",
    platform === "win32" && environment.ProgramFiles
      ? path.join(environment.ProgramFiles, "PostgreSQL", "17", "bin", executable)
      : ""
  ].filter(Boolean);

  return candidates.find(exists) ?? tool;
}
