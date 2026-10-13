/** npm run qr:zip → qr-export/lord-erroll-qr-codes.zip (codes point at APP_URL). */
import fs from "fs";
import path from "path";
import { getTables } from "../src/lib/tables";
import { buildQrZip } from "../src/lib/qr-zip";
import { prisma } from "../src/lib/db";

async function main() {
  if (!process.env.APP_URL || process.env.APP_URL.includes("localhost")) console.warn("⚠ APP_URL is not your public address — the QR codes will point at", process.env.APP_URL);
  const out = path.join(process.cwd(), "qr-export");
  fs.mkdirSync(out, { recursive: true });
  const file = path.join(out, "lord-erroll-qr-codes.zip");
  fs.writeFileSync(file, await buildQrZip(await getTables()));
  console.log("Written", file);
}

main().finally(() => prisma.$disconnect());
