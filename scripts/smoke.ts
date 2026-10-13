/**
 * End-to-end checks against a running server:  npm run smoke  (BASE=https://… to target a deployment)
 * Creates a handful of feedback items flagged as demo, so `npm run db:clear-demo` removes them.
 */
import crypto from "crypto";
import { PrismaClient } from "@prisma/client";

const BASE = process.env.BASE || "http://localhost:3000";
const prisma = new PrismaClient();
let pass = 0, fail = 0;
const check = (name: string, ok: boolean, extra = "") => {
  ok ? pass++ : fail++;
  console.log(`${ok ? "✓" : "✗"} ${name}${extra ? ` — ${extra}` : ""}`);
};

const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Nairobi" }).format(new Date());
const payload = (o: Record<string, unknown> = {}) => ({
  clientId: crypto.randomUUID(), lang: "en", section: "east-wing", table: "22", occasion: "dinner", visitDate: today,
  overall: 2, ratings: { food: 2, service: 1 }, highlights: ["ambience"], improvements: ["wait-time"],
  staffName: "", staffMessage: "", suggestion: `Smoke test ${crypto.randomUUID().slice(0, 6)} — mains were slow.`, nps: 3,
  guestName: "Smoke Test", guestEmail: "smoke@example.com", guestPhone: "", followUp: true,
  startedAt: Date.now() - 60_000, ...o,
});
async function submit(p: Record<string, unknown>, photo?: Buffer) {
  const fd = new FormData();
  fd.set("payload", JSON.stringify(p));
  if (photo) fd.append("photos", new Blob([new Uint8Array(photo)], { type: "image/png" }), "p.png");
  const r = await fetch(`${BASE}/api/feedback`, { method: "POST", body: fd, headers: { "x-forwarded-for": `10.9.${Math.floor(Math.random() * 250)}.1` } });
  return { status: r.status, json: await r.json().catch(() => ({})) };
}

async function main() {
  const page = await fetch(`${BASE}/feedback?section=west-wing&table=12`);
  check("guest site loads", page.status === 200);

  // 1×1 PNG
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
  const p1 = payload();
  const a = await submit(p1, png);
  check("valid submission accepted", a.status === 200 && /^LE-\d+/.test(a.json.ref), a.json.ref);
  const again = await submit(p1);
  check("retry with same clientId is idempotent", again.status === 200 && again.json.ref === a.json.ref && again.json.duplicate);
  check("too-fast submission rejected", (await submit(payload({ startedAt: Date.now() - 2000 }))).status === 422);
  const hp = await submit(payload({ website: "http://spam" }));
  check("honeypot silently swallowed", hp.status === 200 && hp.json.ref === null);
  check("invalid section rejected", (await submit(payload({ section: "kitchen" }))).status === 422);
  check("future visit date rejected", (await submit(payload({ visitDate: "2099-01-01" }))).status === 422);
  check("bad photo type rejected", (await submit(payload(), Buffer.from("not an image"))).status === 415);

  const stored = await prisma.feedback.findFirst({ where: { clientId: p1.clientId as string }, include: { photos: true } });
  check("stored with photo, urgent and follow-up", !!stored && stored.photos.length === 1 && stored.urgent && stored.followUp);
  if (stored) await prisma.feedback.update({ where: { id: stored.id }, data: { isDemo: true } });
  await new Promise((r) => setTimeout(r, 1500));
  const logs = await prisma.notificationLog.findMany({ where: { feedbackId: stored?.id } });
  check("owner alerts attempted (email + WhatsApp + SMS for urgent)", logs.some((l) => l.channel === "EMAIL") && logs.some((l) => l.channel === "WHATSAPP") && logs.some((l) => l.channel === "SMS"), logs.map((l) => `${l.channel}:${l.status}`).join(" "));

  const visitorId = `demo-smoke-${crypto.randomUUID()}`;
  const scan = () => fetch(`${BASE}/api/scan`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ section: "east-wing", table: "22", visitorId }) });
  await scan();
  await scan();
  check("scan counted once per device per day", (await prisma.scanEvent.count({ where: { visitorId } })) === 1);

  check("portal redirects when signed out", (await fetch(`${BASE}/portal`, { redirect: "manual" })).status === 307);
  check("export API refuses anonymous", (await fetch(`${BASE}/api/portal/export?format=csv`)).status === 401);
  check("photo API refuses anonymous", (await fetch(`${BASE}/api/portal/photo/${stored?.photos[0]?.id}`)).status === 401);
  check("cron refuses without secret", (await fetch(`${BASE}/api/cron/digest?kind=daily`)).status === 401);
  if (process.env.CRON_SECRET) {
    const r = await fetch(`${BASE}/api/cron/digest?kind=weekly`, { headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` } });
    check("cron runs weekly digest with secret", r.status === 200, JSON.stringify(await r.json()));
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

main().finally(() => prisma.$disconnect());
