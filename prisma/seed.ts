/**
 * npm run db:seed        → default table plan only (safe for production)
 * npm run db:seed-demo   → plus ~200 sample feedback items, scans, notes and demo staff accounts
 *
 * Demo data is flagged (Feedback.isDemo, demo-* visitor ids, @demo.lord-erroll.local users)
 * and removed in one go with `npm run db:clear-demo`.
 */
import { PrismaClient, type FeedbackStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { DEFAULT_TABLES, SECTIONS, OCCASIONS, HIGHLIGHTS, IMPROVEMENTS, URGENT_THRESHOLD } from "../src/lib/config";
import { classifySentiment } from "../src/lib/sentiment";

const prisma = new PrismaClient();
const demo = process.argv.includes("--demo");

// Deterministic PRNG so demo data is the same on every machine.
let seed = 20261013;
const rand = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = <T,>(a: readonly T[]) => a[Math.floor(rand() * a.length)];
const chance = (p: number) => rand() < p;
const some = <T,>(a: readonly T[], max: number) => [...a].sort(() => rand() - 0.5).slice(0, Math.floor(rand() * (max + 1)));

const COMMENTS: Record<number, string[]> = {
  5: [
    "The fillet steak was cooked to perfection and the service was impeccable. Truly the best dinner we have had in Nairobi this year.",
    "We celebrated our anniversary here and the team made it magical — a candle on the dessert and a handwritten card. Thank you!",
    "Beautiful gardens, a roaring fireplace and the lamb shank was divine. We will be back with the whole family.",
    "Exceptional from start to finish. Our waiter's wine recommendation was spot on.",
    "Chakula kilikuwa kitamu sana na huduma ilikuwa ya kipekee. Asante sana!",
    "Lovely Sunday lunch in the conservatory. The kids loved the desserts and the staff were so welcoming.",
    "Superb business lunch — quiet, elegant and the food arrived promptly. Exactly what we needed.",
    "The crème brûlée alone is worth the drive to Ruaka. Gracious service throughout.",
    "Wonderful evening. Everything felt special without being stuffy.",
    "",
  ],
  4: [
    "Very good food and lovely ambience. Mains took a little while but it was worth the wait.",
    "Great cocktails at the bar and friendly staff. Would love a few more vegetarian options.",
    "Delicious tilapia and good portions. Music was slightly loud near the bar.",
    "Excellent service from our waiter. Dessert menu could be more varied.",
    "Huduma nzuri na mandhari ya kupendeza. Tutarudi tena.",
    "Lovely setting and well-presented dishes. Parking was a little tight on a Friday night.",
    "Good experience overall — the soup was warming and the bread fresh.",
    "",
  ],
  3: [
    "Food was good but we waited almost 45 minutes for our mains.",
    "The starter was lovely but the steak arrived lukewarm. Staff were apologetic.",
    "Nice place but quite expensive for the portion sizes.",
    "Service was slow tonight — it took a while to get the bill.",
    "Ambience is beautiful, but the washroom needed attention.",
    "",
  ],
  2: [
    "Waited over an hour for food and nobody checked on us. Disappointing for the price.",
    "My order was wrong twice and the chicken was overcooked and dry.",
    "The music was so loud we couldn't hold a conversation, and our waiter seemed rushed.",
    "Huduma ilikuwa polepole sana na chakula kilikuja baridi.",
  ],
  1: [
    "Very poor experience. Cold food, rude response when we complained, and we were charged for a dish we never received.",
    "We booked for a birthday and the table wasn't ready. Waited 40 minutes at the bar with no apology.",
    "Found a hair in my soup. The manager was not available. Not acceptable for a restaurant of this standard.",
  ],
};

const STAFF = [
  ["Grace", "Grace was attentive and warm all evening — she remembered our names!"],
  ["Brian", "Brian's wine pairing was spot on."],
  ["Wanjiku", "Wanjiku made our anniversary unforgettable."],
  ["Otieno", "Otieno at the bar makes the best dawa in town."],
  ["Grace", "Thank you Grace for the birthday surprise."],
  ["Kevin", "Kevin was so patient with our children."],
  ["Akinyi", "Akinyi's recommendations were excellent."],
  ["Brian", "Brian went above and beyond."],
  ["Mercy", "Mercy kept checking on us — lovely service."],
  ["Grace at the bar", "Always a pleasure to be served by Grace."],
] as const;

const NAMES = ["Amina Hassan", "David Kamau", "Sarah Wilson", "James Mwangi", "Fatuma Ali", "Peter Njoroge", "Lucy Achieng", "Michael Otieno", "Esther Wambui", "Tom Richards", "Njeri Kariuki", "Daniel Kiprop", "Priya Shah", "John Mutua"];
const NOTES = [
  "Called the guest — very gracious. Invited them back for dinner on the house.",
  "Spoke to the kitchen about mains timing on busy Fridays.",
  "Shared this with the whole team at the morning briefing.",
  "Bar side speakers turned down from 8pm going forward.",
  "Checked CCTV — the table was seated 35 minutes late. Host briefed.",
];

function overallRating() {
  const r = rand();
  return r < 0.46 ? 5 : r < 0.78 ? 4 : r < 0.89 ? 3 : r < 0.96 ? 2 : 1;
}
const around = (base: number) => Math.max(1, Math.min(5, base + (chance(0.55) ? 0 : chance(0.5) ? 1 : -1)));

async function seedTables() {
  await prisma.diningTable.createMany({
    data: Object.entries(DEFAULT_TABLES).flatMap(([section, nums]) => nums.map((number) => ({ section, number }))),
    skipDuplicates: true,
  });
}

async function seedDemo() {
  const hash = await bcrypt.hash("LordErroll-demo-2026", 12);
  const owner =
    (await prisma.user.findFirst({ where: { role: "OWNER", active: true } })) ??
    (await prisma.user.create({ data: { email: "owner@demo.lord-erroll.local", name: "Demo Owner", role: "OWNER", passwordHash: hash, digestMonthly: true } }));
  const manager = await prisma.user.upsert({
    where: { email: "manager@demo.lord-erroll.local" },
    update: {},
    create: { email: "manager@demo.lord-erroll.local", name: "Joyce Mutiso (demo)", role: "MANAGER", passwordHash: hash },
  });
  await prisma.user.upsert({
    where: { email: "supervisor@demo.lord-erroll.local" },
    update: {},
    create: { email: "supervisor@demo.lord-erroll.local", name: "Samuel Oduya (demo)", role: "SUPERVISOR", passwordHash: hash, digestWeekly: false },
  });

  const now = Date.now();
  const DAYS = 120;
  let made = 0;
  for (let d = DAYS; d >= 0; d--) {
    const dayStart = now - d * 86400e3;
    const weekday = new Date(dayStart).getUTCDay();
    const n = Math.floor(rand() * (weekday === 5 || weekday === 6 ? 6 : 3.4)) + (d < 1 ? 2 : 0);
    for (let i = 0; i < n; i++) {
      const section = pick(SECTIONS).slug;
      const table = pick(DEFAULT_TABLES[section]);
      const overall = overallRating();
      const occasion = pick(OCCASIONS).key;
      const hour = occasion === "lunch" ? 13 : occasion === "drinks-lounge" ? 18 : 20;
      // Nairobi local time → UTC
      const createdAt = new Date(new Date(dayStart).setUTCHours(hour - 3 + Math.floor(rand() * 3), Math.floor(rand() * 60), 0, 0));
      if (createdAt.getTime() > now) continue;
      const suggestion = pick(COMMENTS[overall]) || null;
      const staff = overall >= 4 && chance(0.4) ? pick(STAFF) : null;
      const contact = chance(overall <= 3 ? 0.75 : 0.45);
      const name = contact ? pick(NAMES) : null;
      const nps = chance(0.9) ? Math.max(0, Math.min(10, overall * 2 + Math.floor(rand() * 3) - 1)) : null;
      const ageDays = (now - createdAt.getTime()) / 86400e3;
      const status: FeedbackStatus = ageDays > 6 ? "RESOLVED" : ageDays > 2 && chance(0.5) ? "IN_PROGRESS" : chance(0.25) ? "RESOLVED" : "NEW";
      const visit = new Date(Date.UTC(createdAt.getUTCFullYear(), createdAt.getUTCMonth(), createdAt.getUTCDate()));
      const f = await prisma.feedback.create({
        data: {
          clientId: crypto.randomUUID(),
          isDemo: true,
          createdAt,
          visitDate: visit,
          section,
          table,
          occasion,
          overall,
          food: around(overall),
          service: around(overall),
          ambience: Math.min(5, around(overall) + (chance(0.4) ? 1 : 0)),
          cleanliness: chance(0.85) ? around(overall) : null,
          value: chance(0.85) ? around(overall - (chance(0.3) ? 1 : 0)) : null,
          drinks: chance(0.6) ? around(overall) : null,
          speed: chance(0.85) ? around(overall - (chance(0.35) ? 1 : 0)) : null,
          highlights: overall >= 3 ? some(HIGHLIGHTS.map((h) => h.key), 4) : some(HIGHLIGHTS.map((h) => h.key), 1),
          improvements: overall <= 3 ? some(IMPROVEMENTS.map((h) => h.key), 3).concat("wait-time").filter((v, i, a) => a.indexOf(v) === i) : chance(0.3) ? some(IMPROVEMENTS.map((h) => h.key), 1) : [],
          staffName: staff?.[0] ?? null,
          staffMessage: staff?.[1] ?? null,
          suggestion,
          nps,
          guestName: name,
          guestEmail: contact && chance(0.7) ? `${name!.split(" ")[0].toLowerCase()}@example.com` : null,
          guestPhone: contact && chance(0.6) ? `+2547${String(Math.floor(rand() * 1e8)).padStart(8, "0")}` : null,
          followUp: contact && overall <= 3 ? chance(0.8) : false,
          language: suggestion && /chakula|huduma|asante/i.test(suggestion) ? "sw" : "en",
          urgent: overall <= URGENT_THRESHOLD,
          sentiment: classifySentiment({ overall, nps, text: [suggestion, staff?.[1]].filter(Boolean).join(" ") }),
          durationSec: 40 + Math.floor(rand() * 90),
          status,
          resolvedAt: status === "RESOLVED" ? new Date(createdAt.getTime() + (2 + rand() * 40) * 3600e3) : null,
          starred: overall === 5 && chance(0.12),
          assigneeId: overall <= 3 && status !== "NEW" ? manager.id : null,
          firstReadAt: ageDays > 1 ? new Date(createdAt.getTime() + 20 * 60e3) : null,
        },
      });
      made++;
      if (ageDays > 1) {
        await prisma.feedbackRead.createMany({ data: [{ feedbackId: f.id, userId: owner.id }, { feedbackId: f.id, userId: manager.id }], skipDuplicates: true });
      }
      if (overall <= 3 && status !== "NEW") {
        await prisma.note.create({ data: { feedbackId: f.id, authorId: manager.id, body: pick(NOTES), createdAt: new Date(createdAt.getTime() + 3 * 3600e3) } });
      }
      // Scans: every submission came from a scan, plus extra scans that didn't convert.
      const scans = 1 + (chance(0.55) ? 1 : 0) + (chance(0.25) ? 1 : 0);
      for (let s = 0; s < scans; s++) {
        await prisma.scanEvent.create({
          data: { section, table, visitorId: `demo-${crypto.randomUUID()}`, day: visit, createdAt: new Date(createdAt.getTime() - 5 * 60e3) },
        });
      }
    }
  }
  // Pin one recent urgent item so the inbox shows the feature.
  const urgent = await prisma.feedback.findFirst({ where: { isDemo: true, urgent: true }, orderBy: { createdAt: "desc" } });
  if (urgent) await prisma.feedback.update({ where: { id: urgent.id }, data: { pinned: true } });
  console.log(`Demo data: ${made} feedback items. Demo logins (password LordErroll-demo-2026):`);
  console.log(`  manager@demo.lord-erroll.local · supervisor@demo.lord-erroll.local${owner.email.endsWith("@demo.lord-erroll.local") ? " · owner@demo.lord-erroll.local" : ""}`);
}

async function main() {
  await seedTables();
  console.log("Tables seeded.");
  if (demo) {
    const existing = await prisma.feedback.count({ where: { isDemo: true } });
    if (existing) console.log(`Demo data already present (${existing} items). Run npm run db:clear-demo first to regenerate.`);
    else await seedDemo();
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
