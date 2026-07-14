import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  backupFileName,
  buildPostgresConnection,
  resolvePostgresTool,
  shouldDeleteBackup
} from "../src/server/ops/database-tools";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const now = new Date();
const backupDirectory = path.resolve(process.env.BACKUP_DIR || path.join(process.cwd(), "backups"));
const retentionDays = Number.parseInt(process.env.BACKUP_RETENTION_DAYS || "14", 10);
if (!Number.isInteger(retentionDays) || retentionDays < 1) {
  throw new Error("BACKUP_RETENTION_DAYS must be a positive integer");
}

mkdirSync(backupDirectory, { recursive: true });
const destination = path.join(backupDirectory, backupFileName(now));
const connection = buildPostgresConnection(databaseUrl);
const executable = resolvePostgresTool("pg_dump", process.env, existsSync);
const result = spawnSync(executable, [
  ...connection.args,
  "--format=custom",
  "--no-owner",
  "--file", destination
], {
  stdio: "inherit",
  env: { ...process.env, PGPASSWORD: connection.password }
});

if (result.error || result.status !== 0) {
  if (existsSync(destination)) unlinkSync(destination);
  throw result.error ?? new Error(`pg_dump exited with status ${result.status}`);
}

for (const fileName of readdirSync(backupDirectory)) {
  const filePath = path.join(backupDirectory, fileName);
  const stats = statSync(filePath);
  if (stats.isFile() && shouldDeleteBackup(fileName, stats.mtime, now, retentionDays)) {
    unlinkSync(filePath);
  }
}

console.log(`Database backup created: ${destination}`);
