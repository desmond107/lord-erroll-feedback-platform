/**
 * npm run backup  → backups/lord-erroll-<timestamp>.sql.gz (pg_dump) and a portable JSON export.
 * Schedule daily with cron, e.g. `0 3 * * * cd /srv/lord-erroll && npm run backup`.
 * Managed Postgres (Supabase/Neon/RDS) also keep their own point-in-time backups — enable them.
 */
import { PrismaClient } from "@prisma/client";
import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import zlib from "zlib";

const prisma = new PrismaClient();
const KEEP = 30;

async function main() {
  const dir = path.join(process.cwd(), "backups");
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);

  try {
    const url = process.env.DATABASE_URL!.replace(/\?schema=\w+/, "");
    const sql = execFileSync("pg_dump", ["--no-owner", "--no-privileges", url], { maxBuffer: 1024 * 1024 * 1024 });
    fs.writeFileSync(path.join(dir, `lord-erroll-${stamp}.sql.gz`), zlib.gzipSync(sql));
    console.log(`pg_dump backup written (${(sql.length / 1024).toFixed(0)} KB raw).`);
  } catch (e) {
    console.warn("pg_dump unavailable or failed — JSON export only.", (e as Error).message);
  }

  const data = {
    exportedAt: new Date().toISOString(),
    feedback: await prisma.feedback.findMany({ include: { notes: true, replies: true } }),
    photos: (await prisma.feedbackPhoto.findMany()).map((p) => ({ ...p, data: Buffer.from(p.data).toString("base64") })),
    users: (await prisma.user.findMany()).map(({ passwordHash: _p, totpSecret: _t, ...u }) => u),
    tables: await prisma.diningTable.findMany(),
  };
  fs.writeFileSync(path.join(dir, `lord-erroll-${stamp}.json.gz`), zlib.gzipSync(JSON.stringify(data)));
  console.log(`JSON export written: ${data.feedback.length} feedback items.`);

  // Rotate
  const files = fs.readdirSync(dir).filter((f) => f.startsWith("lord-erroll-")).sort();
  const groups = [...new Set(files.map((f) => f.replace(/\.(sql|json)\.gz$/, "")))];
  for (const g of groups.slice(0, Math.max(0, groups.length - KEEP))) for (const f of files.filter((x) => x.startsWith(g))) fs.unlinkSync(path.join(dir, f));
}

main().finally(() => prisma.$disconnect());
