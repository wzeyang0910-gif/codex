import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  seedDatabase,
  type PasswordHasher,
  type SeedDatabase
} from "../../prisma/seed-credentials";

type RecordedCall =
  | { kind: "product"; args: unknown }
  | { kind: "transaction:start" }
  | { kind: "user"; args: Record<string, unknown> }
  | { kind: "transaction:commit" };

function createRecordingDatabase() {
  const calls: RecordedCall[] = [];
  const database: SeedDatabase = {
    product: {
      async upsert(args) {
        calls.push({ kind: "product", args });
        return {};
      }
    },
    async $transaction(operation) {
      calls.push({ kind: "transaction:start" });
      const result = await operation({
        user: {
          async upsert(args) {
            calls.push({ kind: "user", args });
            return {};
          }
        }
      });
      calls.push({ kind: "transaction:commit" });
      return result;
    }
  };

  return { calls, database };
}

function strongPassword(label: string) {
  return `${label}Aa!${"9".repeat(12)}`;
}

const validEnvironment = {
  SEED_ADMIN_PASSWORD: strongPassword("Admin"),
  SEED_SALES_PASSWORD: strongPassword("Sales")
};

describe("seed credentials", () => {
  it.each([
    ["a missing password", { ...validEnvironment, SEED_ADMIN_PASSWORD: undefined }],
    ["a weak password", { ...validEnvironment, SEED_ADMIN_PASSWORD: "too-short" }],
    [
      "matching passwords",
      {
        SEED_ADMIN_PASSWORD: validEnvironment.SEED_ADMIN_PASSWORD,
        SEED_SALES_PASSWORD: validEnvironment.SEED_ADMIN_PASSWORD
      }
    ]
  ])("rejects %s before hashing or accessing Prisma", async (_case, environment) => {
    const { calls, database } = createRecordingDatabase();
    const hashCalls: string[] = [];
    const hashPassword: PasswordHasher = async (password) => {
      hashCalls.push(password);
      return "unused-hash";
    };

    await expect(
      seedDatabase({ database, environment, hashPassword })
    ).rejects.toThrow();

    expect(hashCalls).toEqual([]);
    expect(calls).toEqual([]);
  });

  it("hashes both strong passwords and upserts both users in one transaction", async () => {
    const { calls, database } = createRecordingDatabase();
    const hashCalls: Array<{ password: string; rounds: number }> = [];
    const hashPassword: PasswordHasher = async (password, rounds) => {
      hashCalls.push({ password, rounds });
      return `generated-hash-${hashCalls.length}`;
    };

    await seedDatabase({ database, environment: validEnvironment, hashPassword });

    expect(hashCalls).toEqual([
      { password: validEnvironment.SEED_ADMIN_PASSWORD, rounds: 10 },
      { password: validEnvironment.SEED_SALES_PASSWORD, rounds: 10 }
    ]);
    expect(calls.filter((call) => call.kind === "transaction:start")).toHaveLength(1);
    expect(calls.filter((call) => call.kind === "transaction:commit")).toHaveLength(1);

    const transactionStart = calls.findIndex((call) => call.kind === "transaction:start");
    const transactionCommit = calls.findIndex((call) => call.kind === "transaction:commit");
    const userCalls = calls.filter((call) => call.kind === "user");
    expect(userCalls).toHaveLength(2);
    expect(calls.slice(transactionStart + 1, transactionCommit)).toEqual(userCalls);
    expect(userCalls.map((call) => {
      if (call.kind !== "user") return undefined;
      const update = call.args.update as { passwordHash: string };
      return update.passwordHash;
    })).toEqual(["generated-hash-1", "generated-hash-2"]);
  });

  it("uses newly generated hashes every time seed is repeated", async () => {
    const { calls, database } = createRecordingDatabase();
    let hashSequence = 0;
    const hashPassword: PasswordHasher = async () => `rotated-hash-${++hashSequence}`;

    await seedDatabase({ database, environment: validEnvironment, hashPassword });
    await seedDatabase({ database, environment: validEnvironment, hashPassword });

    const passwordHashes = calls
      .filter((call): call is Extract<RecordedCall, { kind: "user" }> => call.kind === "user")
      .map((call) => (call.args.update as { passwordHash: string }).passwordHash);
    expect(passwordHashes).toEqual([
      "rotated-hash-1",
      "rotated-hash-2",
      "rotated-hash-3",
      "rotated-hash-4"
    ]);
  });

  it("keeps the seed command and templates free of known default credentials", () => {
    const packageJson = JSON.parse(
      readFileSync(resolve(process.cwd(), "package.json"), "utf8")
    ) as { scripts: { "prisma:seed": string } };
    const seedSource = readFileSync(resolve(process.cwd(), "prisma/seed.ts"), "utf8");
    const environmentTemplate = readFileSync(resolve(process.cwd(), ".env.example"), "utf8");

    expect(packageJson.scripts["prisma:seed"]).toContain("--env-file=.env");
    expect(`${seedSource}\n${environmentTemplate}`).not.toContain("123456");
  });
});
