import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/db";
import { yonyeProducts } from "../src/lib/products";

function requireStrongPassword(variableName: string) {
  const password = process.env[variableName];

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

async function main() {
  const adminPassword = requireStrongPassword("SEED_ADMIN_PASSWORD");
  const salesPassword = requireStrongPassword("SEED_SALES_PASSWORD");
  if (adminPassword === salesPassword) {
    throw new Error("SEED_ADMIN_PASSWORD and SEED_SALES_PASSWORD must be different");
  }
  const [adminPasswordHash, salesPasswordHash] = await Promise.all([
    bcrypt.hash(adminPassword, 10),
    bcrypt.hash(salesPassword, 10)
  ]);

  for (const product of yonyeProducts) {
    await prisma.product.upsert({
      where: { key: product.key },
      update: product,
      create: product
    });
  }

  await prisma.user.upsert({
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

  await prisma.user.upsert({
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
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
