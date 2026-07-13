import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/db";
import { seedDatabase } from "./seed-credentials";

async function main() {
  await seedDatabase({
    database: {
      product: {
        upsert: (args) => prisma.product.upsert(args)
      },
      $transaction: (operation) =>
        prisma.$transaction((transaction) =>
          operation({
            user: {
              upsert: (args) => transaction.user.upsert(args)
            }
          })
        )
    },
    environment: process.env,
    hashPassword: bcrypt.hash
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
