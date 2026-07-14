import { existsSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { buildPostgresConnection, resolvePostgresTool } from "../src/server/ops/database-tools";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const argumentsList = process.argv.slice(2);
const confirmed = argumentsList.includes("--confirm");
const backupArgument = argumentsList.find((argument) => argument !== "--confirm");

if (!backupArgument || !confirmed) {
  throw new Error("Usage: npm run db:restore -- <backup.dump> --confirm");
}

const backupPath = path.resolve(backupArgument);
if (!backupPath.endsWith(".dump") || !existsSync(backupPath)) {
  throw new Error("The requested .dump backup file does not exist");
}

const connection = buildPostgresConnection(databaseUrl);
const executable = resolvePostgresTool("pg_restore", process.env, existsSync);
const result = spawnSync(executable, [
  ...connection.args,
  "--clean",
  "--if-exists",
  "--no-owner",
  "--exit-on-error",
  "--single-transaction",
  backupPath
], {
  stdio: "inherit",
  env: { ...process.env, PGPASSWORD: connection.password }
});

if (result.error || result.status !== 0) {
  throw result.error ?? new Error(`pg_restore exited with status ${result.status}`);
}

console.log(`Database restored from: ${backupPath}`);
