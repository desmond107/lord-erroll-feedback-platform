import "server-only";
import { prisma } from "./db";
import { CATEGORIES, HIGHLIGHTS, IMPROVEMENTS, OCCASIONS, SECTIONS } from "./config";
import { avg, nairobiDateKey, npsScore } from "./format";
import { THEMES, textSentiment, themesFor, wordFrequencies } from "./sentiment";

export type Range = { from: Date; to: Date; key: string; label: string };

export const RANGES = [
  { key: "7d", label: "Last 7 days", days: 7 },
  { key: "30d", label: "Last 30 days", days: 30 },
  { key: "90d", label: "Last 90 days", days: 90 },
  { key: "365d", label: "Last 12 months", days: 365 },
] as const;

export function resolveRange(key?: string): Range {
  const r = RANGES.find((x) => x.key === key) ?? RANGES[1];
  const to = new Date();
  const from = new Date(to.getTime() - r.days * 86400e3);
  return { from, to, key: r.key, label: r.label };
}

const SELECT = {
  id: true, createdAt: true, section: true, table: true, occasion: true, overall: true,
  food: true, service: true, ambience: true, cleanliness: true, value: true, drinks: true, speed: true,
  highlights: true, improvements: true, staffName: true, staffMessage: true, suggestion: true, nps: true,
  sentiment: true, urgent: true, status: true, resolvedAt: true,
} as const;

type Bucket = "day" | "week" | "month";

function bucketKey(d: Date, b: Bucket) {
  const key = nairobiDateKey(d);
  if (b === "day") return key;
  if (b === "month") return key.slice(0, 7);
  const dt = new Date(`${key}T00:00:00Z`);
  const dow = (dt.getUTCDay() + 6) % 7; // Monday-based weeks
  dt.setUTCDate(dt.getUTCDate() - dow);
  return dt.toISOString().slice(0, 10);
}

function bucketLabel(key: string, b: Bucket) {
  if (b === "month") return new Intl.DateTimeFormat("en-GB", { month: "short", year: "2-digit", timeZone: "UTC" }).format(new Date(`${key}-01T00:00:00Z`));
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${key}T00:00:00Z`));
}

function allBuckets(from: Date, to: Date, b: Bucket) {
  const keys: string[] = [];
  const cursor = new Date(from);
  while (cursor <= to) {
    const k = bucketKey(cursor, b);
    if (keys[keys.length - 1] !== k) keys.push(k);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  const last = bucketKey(to, b);
  if (keys[keys.length - 1] !== last) keys.push(last);
  return keys;
}

export function normaliseStaffName(name: string) {
  return name.trim().replace(/\s+/g, " ").replace(/^(the\s+)/i, "").replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function getInsights(range: Range, bucket?: Bucket) {
  const rows = await prisma.feedback.findMany({ where: { createdAt: { gte: range.from, lte: range.to } }, select: SELECT, orderBy: { createdAt: "asc" } });
  const days = (range.to.getTime() - range.from.getTime()) / 86400e3;
  const b: Bucket = bucket ?? (days <= 31 ? "day" : days <= 120 ? "week" : "month");

  // Previous period of equal length, for deltas.
  const prevFrom = new Date(range.from.getTime() - (range.to.getTime() - range.from.getTime()));
  const prev = await prisma.feedback.findMany({ where: { createdAt: { gte: prevFrom, lt: range.from } }, select: { overall: true, nps: true } });

  const totals = {
    count: rows.length,
    avgOverall: avg(rows.map((r) => r.overall)),
    nps: npsScore(rows.map((r) => r.nps)),
    urgent: rows.filter((r) => r.urgent).length,
    open: rows.filter((r) => r.status !== "RESOLVED").length,
    openUrgent: rows.filter((r) => r.urgent && r.status !== "RESOLVED").length,
    prevCount: prev.length,
    prevAvg: avg(prev.map((r) => r.overall)),
    prevNps: npsScore(prev.map((r) => r.nps)),
    avgResolutionHours: avg(rows.filter((r) => r.resolvedAt).map((r) => (r.resolvedAt!.getTime() - r.createdAt.getTime()) / 3600e3)),
    distribution: [1, 2, 3, 4, 5].map((n) => rows.filter((r) => r.overall === n).length),
    promoters: rows.filter((r) => r.nps != null && r.nps >= 9).length,
    passives: rows.filter((r) => r.nps != null && r.nps >= 7 && r.nps <= 8).length,
    detractors: rows.filter((r) => r.nps != null && r.nps <= 6).length,
  };

  const trendMap = new Map<string, { count: number; sum: number; nps: number[] }>();
  for (const k of allBuckets(range.from, range.to, b)) trendMap.set(k, { count: 0, sum: 0, nps: [] });
  for (const r of rows) {
    const k = bucketKey(r.createdAt, b);
    const t = trendMap.get(k) ?? { count: 0, sum: 0, nps: [] };
    t.count++;
    t.sum += r.overall;
    if (r.nps != null) t.nps.push(r.nps);
    trendMap.set(k, t);
  }
  const trend = [...trendMap.entries()].map(([key, t]) => ({
    key, label: bucketLabel(key, b), count: t.count, avg: t.count ? t.sum / t.count : null, nps: npsScore(t.nps),
  }));

  const catAvg = (subset: typeof rows) =>
    Object.fromEntries(CATEGORIES.map((c) => [c.key, avg(subset.map((r) => r[c.key as keyof typeof r] as number | null))])) as Record<string, number | null>;

  const bySection = SECTIONS.map((s) => {
    const sub = rows.filter((r) => r.section === s.slug);
    return { slug: s.slug, label: s.en, count: sub.length, avg: avg(sub.map((r) => r.overall)), nps: npsScore(sub.map((r) => r.nps)), urgent: sub.filter((r) => r.urgent).length, categories: catAvg(sub) };
  });

  const byCategory = CATEGORIES.map((c) => {
    const vals = rows.map((r) => r[c.key as keyof typeof r] as number | null).filter((v): v is number => v != null);
    return { key: c.key, label: c.en, avg: avg(vals), count: vals.length };
  });

  const byOccasion = OCCASIONS.map((o) => {
    const sub = rows.filter((r) => r.occasion === o.key);
    return { key: o.key, label: o.en, count: sub.length, avg: avg(sub.map((r) => r.overall)) };
  }).sort((a, b) => b.count - a.count);

  const staffMap = new Map<string, { name: string; count: number; ratings: number[]; quotes: string[] }>();
  for (const r of rows) {
    if (!r.staffName) continue;
    const name = normaliseStaffName(r.staffName);
    const key = name.toLowerCase().split(" ")[0]; // "Grace", "Grace at the bar" → one person
    const s = staffMap.get(key) ?? { name: name.split(" ")[0], count: 0, ratings: [], quotes: [] };
    s.count++;
    s.ratings.push(r.overall);
    if (r.staffMessage) s.quotes.push(r.staffMessage);
    staffMap.set(key, s);
  }
  const staff = [...staffMap.values()]
    .map((s) => ({ name: s.name, count: s.count, avg: avg(s.ratings), quote: s.quotes[s.quotes.length - 1] ?? null }))
    .sort((a, b) => b.count - a.count || (b.avg ?? 0) - (a.avg ?? 0));

  const texts = rows.map((r) => [r.suggestion, r.staffMessage].filter(Boolean).join(" ")).filter(Boolean);
  const themes = THEMES.map((t) => {
    let pos = 0, neu = 0, neg = 0;
    for (const r of rows) {
      const text = [r.suggestion, r.staffMessage].filter(Boolean).join(" ");
      if (!text || !themesFor(text).includes(t.key)) continue;
      const s = textSentiment(text) + (r.overall - 3);
      if (s >= 1) pos++;
      else if (s <= -1) neg++;
      else neu++;
    }
    return { key: t.key, label: t.label, total: pos + neu + neg, positive: pos, neutral: neu, negative: neg };
  })
    .filter((t) => t.total > 0)
    .sort((a, b) => b.total - a.total);

  const sentiment = {
    POSITIVE: rows.filter((r) => r.sentiment === "POSITIVE").length,
    NEUTRAL: rows.filter((r) => r.sentiment === "NEUTRAL").length,
    NEGATIVE: rows.filter((r) => r.sentiment === "NEGATIVE").length,
  };

  const chipCount = (field: "highlights" | "improvements", list: readonly { key: string; en: string }[]) =>
    list.map((h) => ({ key: h.key, label: h.en, count: rows.filter((r) => r[field].includes(h.key)).length })).filter((x) => x.count).sort((a, b) => b.count - a.count);

  return {
    range, bucket: b, totals, trend, bySection, byCategory, byOccasion, staff, themes, sentiment,
    words: wordFrequencies(texts, 45),
    highlights: chipCount("highlights", HIGHLIGHTS),
    improvements: chipCount("improvements", IMPROVEMENTS),
  };
}

export async function getQrStats(range: Range) {
  const [scans, subs] = await Promise.all([
    prisma.scanEvent.groupBy({ by: ["section", "table"], where: { createdAt: { gte: range.from, lte: range.to } }, _count: { _all: true } }),
    prisma.feedback.groupBy({ by: ["section", "table"], where: { createdAt: { gte: range.from, lte: range.to } }, _count: { _all: true } }),
  ]);
  const key = (s: string, t: string | null) => `${s}|${t ?? ""}`;
  const map = new Map<string, { section: string; table: string; scans: number; submissions: number }>();
  for (const s of scans) map.set(key(s.section, s.table), { section: s.section, table: s.table, scans: s._count._all, submissions: 0 });
  for (const s of subs) {
    const k = key(s.section, s.table);
    const e = map.get(k) ?? { section: s.section, table: s.table ?? "", scans: 0, submissions: 0 };
    e.submissions += s._count._all;
    map.set(k, e);
  }
  const tables = [...map.values()];
  const bySection = SECTIONS.map((s) => {
    const sub = tables.filter((t) => t.section === s.slug);
    const sc = sub.reduce((a, t) => a + t.scans, 0);
    const su = sub.reduce((a, t) => a + t.submissions, 0);
    return { slug: s.slug, label: s.en, scans: sc, submissions: su, rate: sc ? Math.min(1, su / sc) : null };
  });
  const totalScans = bySection.reduce((a, s) => a + s.scans, 0);
  const totalSubs = bySection.reduce((a, s) => a + s.submissions, 0);
  return { tables, bySection, totalScans, totalSubs, rate: totalScans ? Math.min(1, totalSubs / totalScans) : null };
}
