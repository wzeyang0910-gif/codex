import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/db";
import { yonyeProducts } from "../src/lib/products";

async function main() {
  for (const product of yonyeProducts) {
    await prisma.product.upsert({
      where: { key: product.key },
      update: product,
      create: product
    });
  }

  await prisma.user.upsert({
    where: { email: "admin@cnyonye.local" },
    update: {},
    create: {
      name: "Admin",
      email: "admin@cnyonye.local",
      passwordHash: await bcrypt.hash("123456", 10),
      role: "admin"
    }
  });

  await prisma.user.upsert({
    where: { email: "sales@cnyonye.local" },
    update: {},
    create: {
      name: "Sales",
      email: "sales@cnyonye.local",
      passwordHash: await bcrypt.hash("123456", 10),
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
