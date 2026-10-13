/** Removes everything created by `npm run db:seed-demo`. Real guest feedback is never touched. */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const fb = await prisma.feedback.deleteMany({ where: { isDemo: true } });
  const scans = await prisma.scanEvent.deleteMany({ where: { visitorId: { startsWith: "demo-" } } });
  const users = await prisma.user.deleteMany({ where: { email: { endsWith: "@demo.lord-erroll.local" } } });
  console.log(`Removed ${fb.count} demo feedback items, ${scans.count} demo scans and ${users.count} demo accounts.`);
}

main().finally(() => prisma.$disconnect());
