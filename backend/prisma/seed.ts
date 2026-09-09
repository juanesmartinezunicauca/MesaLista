import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Skeleton seed script - No implementation yet
  console.log('Seed skeleton ready.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
