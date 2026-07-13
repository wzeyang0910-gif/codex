import type { Prisma } from "@prisma/client";
import { yonyeProducts } from "../src/lib/products";

export type PasswordHasher = (password: string, rounds: number) => Promise<string>;

type SeedTransaction = {
  user: {
    upsert(args: Prisma.UserUpsertArgs): Promise<unknown>;
  };
};

export type SeedDatabase = {
  product: {
    upsert(args: Prisma.ProductUpsertArgs): Promise<unknown>;
  };
  $transaction<T>(operation: (transaction: SeedTransaction) => Promise<T>): Promise<T>;
};

type SeedEnvironment = Record<string, string | undefined>;

type SeedDatabaseOptions = {
  database: SeedDatabase;
  environment: SeedEnvironment;
  hashPassword: PasswordHasher;
};

function requireStrongPassword(
  environment: SeedEnvironment,
  variableName: "SEED_ADMIN_PASSWORD" | "SEED_SALES_PASSWORD"
) {
  const password = environment[variableName];

  if (!password) {
    throw new Error(`${variableName} is required`);
  }

  const isWeak =
    password.length < 12 ||
    !/[a-z]/.test(password) ||
    !/[A-Z]/.test(password) ||
    !/\d/.test(password) ||
    !/[^A-Za-z0-9]/.test(password);

  if (isWeak) {
    throw new Error(
      `${variableName} is weak: use at least 12 characters with uppercase, lowercase, number, and symbol`
    );
  }

  return password;
}

export async function seedDatabase({
  database,
  environment,
  hashPassword
}: SeedDatabaseOptions) {
  const adminPassword = requireStrongPassword(environment, "SEED_ADMIN_PASSWORD");
  const salesPassword = requireStrongPassword(environment, "SEED_SALES_PASSWORD");

  if (adminPassword === salesPassword) {
    throw new Error("SEED_ADMIN_PASSWORD and SEED_SALES_PASSWORD must be different");
  }

  const [adminPasswordHash, salesPasswordHash] = await Promise.all([
    hashPassword(adminPassword, 10),
    hashPassword(salesPassword, 10)
  ]);

  for (const product of yonyeProducts) {
    await database.product.upsert({
      where: { key: product.key },
      update: product,
      create: product
    });
  }

  await database.$transaction(async (transaction) => {
    await transaction.user.upsert({
      where: { email: "admin@cnyonye.local" },
      update: {
        name: "Admin",
        passwordHash: adminPasswordHash,
        role: "admin"
      },
      create: {
        name: "Admin",
        email: "admin@cnyonye.local",
        passwordHash: adminPasswordHash,
        role: "admin"
      }
    });

    await transaction.user.upsert({
      where: { email: "sales@cnyonye.local" },
      update: {
        name: "Sales",
        passwordHash: salesPasswordHash,
        role: "sales"
      },
      create: {
        name: "Sales",
        email: "sales@cnyonye.local",
        passwordHash: salesPasswordHash,
        role: "sales"
      }
    });
  });
}
