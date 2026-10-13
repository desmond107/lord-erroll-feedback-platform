import "server-only";
import { prisma } from "./db";
import { SECTIONS } from "./config";
import { avg, fmtDate, nairobiDateKey, nairobiDayStart, npsScore } from "./format";
import { digestEmail } from "./emails";
import { sendEmail } from "./notify";
import { getInsights, getQrStats, normaliseStaffName } from "./stats";
import { monthlyReportPdf } from "./pdf";

export type DigestKind = "daily" | "weekly" | "monthly";

/** Period that has just finished, in Nairobi time. */
export function digestPeriod(kind: DigestKind, now = new Date()) {
  const today = nairobiDayStart(nairobiDateKey(now));
  if (kind === "daily") return { from: new Date(today.getTime() - 86400e3), to: today };
  if (kind === "weekly") return { from: new Date(today.getTime() - 7 * 86400e3), to: today };
  const key = nairobiDateKey(now);
  const [y, m] = key.split("-").map(Number);
  const prevY = m === 1 ? y - 1 : y, prevM = m === 1 ? 12 : m - 1;
  const from = nairobiDayStart(`${prevY}-${String(prevM).padStart(2, "0")}-01`);
  const to = nairobiDayStart(`${y}-${String(m).padStart(2, "0")}-01`);
  return { from, to };
}

export async function runDigest(kind: DigestKind, opts: { onlyTo?: string } = {}) {
  const { from, to } = digestPeriod(kind);
  const items = await prisma.feedback.findMany({ where: { createdAt: { gte: from, lt: to } }, orderBy: { createdAt: "desc" } });
  const pref = kind === "daily" ? "digestDaily" : kind === "weekly" ? "digestWeekly" : "digestMonthly";
  const recipients = opts.onlyTo
    ? [opts.onlyTo]
    : (await prisma.user.findMany({ where: { active: true, [pref]: true }, select: { email: true } })).map((u) => u.email);
  if (!recipients.length) return { kind, sent: 0, items: items.length };

  const staff = new Map<string, number>();
  for (const f of items) if (f.staffName) {
    const n = normaliseStaffName(f.staffName).split(" ")[0];
    staff.set(n, (staff.get(n) ?? 0) + 1);
  }
  const lastDay = new Date(to.getTime() - 1);
  const periodText = kind === "daily" ? fmtDate(from, { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : `${fmtDate(from)} – ${fmtDate(lastDay)}`;
  const label = kind === "daily" ? "Daily digest" : kind === "weekly" ? "Weekly digest" : `Monthly report · ${fmtDate(from, { month: "long", year: "numeric" })}`;
  const mail = digestEmail({
    label, periodText,
    total: items.length,
    avgOverall: avg(items.map((f) => f.overall)),
    nps: npsScore(items.map((f) => f.nps)),
    urgent: items.filter((f) => f.urgent).length,
    open: await prisma.feedback.count({ where: { status: { not: "RESOLVED" } } }),
    bySection: SECTIONS.map((s) => {
      const sub = items.filter((f) => f.section === s.slug);
      return { label: s.en, count: sub.length, avg: avg(sub.map((f) => f.overall)) };
    }),
    topStaff: [...staff.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count })),
    items,
  });

  let attachments: { filename: string; content: Buffer }[] | undefined;
  if (kind === "monthly") {
    const range = { from, to, key: "month", label };
    const [ins, qr] = await Promise.all([getInsights(range, "week"), getQrStats(range)]);
    const pdf = await monthlyReportPdf(label, periodText, ins, qr, items.filter((f) => f.urgent));
    attachments = [{ filename: `lord-erroll-feedback-${nairobiDateKey(from).slice(0, 7)}.pdf`, content: pdf }];
  }
  const r = await sendEmail({ to: recipients, ...mail, attachments, kind: `digest-${kind}` });
  return { kind, sent: r.status === "SENT" ? recipients.length : 0, status: r.status, items: items.length };
}
