/**
 * Create (or reset) an owner account.
 *   npm run owner:create -- --email s@lorderrll.com --name "Owner Name"
 * Prints a strong temporary password unless --password is given.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const prisma = new PrismaClient();
const arg = (k: string) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > -1 ? process.argv[i + 1] : undefined;
};

async function main() {
  const email = arg("email")?.trim().toLowerCase();
  const name = arg("name")?.trim() || "Owner";
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    console.error('Usage: npm run owner:create -- --email you@example.com --name "Your Name" [--password ...]');
    process.exit(1);
  }
  const password = arg("password") || `${crypto.randomBytes(9).toString("base64url")}9`;
  if (password.length < 10) throw new Error("Password must be at least 10 characters.");
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.upsert({
    where: { email },
    update: { role: "OWNER", active: true, passwordHash, name },
    create: { email, name, role: "OWNER", passwordHash, digestDaily: true, digestWeekly: true, digestMonthly: true },
  });
  await prisma.session.deleteMany({ where: { userId: user.id } });
  await prisma.activityLog.create({ data: { action: "user.created", target: email, detail: "OWNER via CLI" } });
  console.log(`\nOwner account ready: ${email}`);
  if (!arg("password")) console.log(`Temporary password: ${password}\nSign in at /portal/login and change it under Settings.\n`);
}

main().finally(() => prisma.$disconnect());
