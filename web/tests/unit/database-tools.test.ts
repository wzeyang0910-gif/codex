import { describe, expect, it } from "vitest";
import {
  backupFileName,
  buildPostgresConnection,
  resolvePostgresTool,
  shouldDeleteBackup
} from "@/server/ops/database-tools";

describe("database operation helpers", () => {
  it("builds pg tool arguments without placing the password in the command line", () => {
    const connection = buildPostgresConnection(
      "postgresql://yonye:p%40ssword@127.0.0.1:5433/yonye_leads?schema=public"
    );

    expect(connection).toEqual({
      args: [
        "--host", "127.0.0.1",
        "--port", "5433",
        "--username", "yonye",
        "--dbname", "yonye_leads"
      ],
      password: "p@ssword"
    });
    expect(connection.args.join(" ")).not.toContain("p@ssword");
  });

  it("rejects unsupported or incomplete database URLs", () => {
    expect(() => buildPostgresConnection("mysql://user:pass@localhost/db")).toThrow("PostgreSQL");
    expect(() => buildPostgresConnection("postgresql://localhost")).toThrow("database name");
  });

  it("creates stable timestamped backup names", () => {
    expect(backupFileName(new Date("2026-07-14T02:03:04.000Z"))).toBe(
      "yonye_leads_20260714_020304.dump"
    );
  });

  it("prefers the configured PostgreSQL binary directory", () => {
    const exists = (filePath: string) => filePath === "C:\\Postgres\\bin\\pg_dump.exe";
    expect(resolvePostgresTool("pg_dump", {
      POSTGRES_BIN: "C:\\Postgres\\bin"
    }, exists, "win32")).toBe("C:\\Postgres\\bin\\pg_dump.exe");
  });

  it("only prunes matching backup files older than the retention window", () => {
    const now = new Date("2026-07-20T00:00:00.000Z");
    expect(shouldDeleteBackup("yonye_leads_20260701_010203.dump", new Date("2026-07-01"), now, 14)).toBe(true);
    expect(shouldDeleteBackup("yonye_leads_20260710_010203.dump", new Date("2026-07-10"), now, 14)).toBe(false);
    expect(shouldDeleteBackup("other.dump", new Date("2026-06-01"), now, 14)).toBe(false);
  });
});
