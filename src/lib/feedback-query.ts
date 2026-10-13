import "server-only";
import type { FeedbackStatus, Prisma } from "@prisma/client";
import { nairobiDayStart } from "./format";

export type Filters = {
  q?: string;
  status?: string;
  rating?: string; // "urgent" | "1".."5" | "positive"
  section?: string;
  table?: string;
  occasion?: string;
  staff?: string;
  from?: string; // YYYY-MM-DD (Nairobi)
  to?: string;
  view?: string; // "unread" | "starred" | "followup" | "mine"
  page?: string;
};

export const FILTER_KEYS: (keyof Filters)[] = ["q", "status", "rating", "section", "table", "occasion", "staff", "from", "to", "view", "page"];

export function readFilters(sp: Record<string, string | string[] | undefined> | URLSearchParams): Filters {
  const get = (k: string) => (sp instanceof URLSearchParams ? sp.get(k) : (Array.isArray(sp[k]) ? sp[k]![0] : sp[k])) ?? undefined;
  const f: Filters = {};
  for (const k of FILTER_KEYS) {
    const v = get(k)?.trim();
    if (v) f[k] = v.slice(0, 200);
  }
  return f;
}

export function buildWhere(f: Filters, userId?: string): Prisma.FeedbackWhereInput {
  const and: Prisma.FeedbackWhereInput[] = [];
  if (f.status && ["NEW", "IN_PROGRESS", "RESOLVED"].includes(f.status)) and.push({ status: f.status as FeedbackStatus });
  if (f.status === "OPEN") and.push({ status: { not: "RESOLVED" } });
  if (f.rating === "urgent") and.push({ urgent: true });
  else if (f.rating === "positive") and.push({ overall: { gte: 4 } });
  else if (f.rating && /^[1-5]$/.test(f.rating)) and.push({ overall: Number(f.rating) });
  if (f.section) and.push({ section: f.section });
  if (f.table) and.push({ table: f.table });
  if (f.occasion) and.push({ occasion: f.occasion });
  if (f.staff) and.push({ staffName: { contains: f.staff, mode: "insensitive" } });
  if (f.from && /^\d{4}-\d{2}-\d{2}$/.test(f.from)) and.push({ createdAt: { gte: nairobiDayStart(f.from) } });
  if (f.to && /^\d{4}-\d{2}-\d{2}$/.test(f.to)) and.push({ createdAt: { lt: new Date(nairobiDayStart(f.to).getTime() + 86400e3) } });
  if (f.view === "unread" && userId) and.push({ reads: { none: { userId } } });
  if (f.view === "starred") and.push({ starred: true });
  if (f.view === "followup") and.push({ followUp: true, status: { not: "RESOLVED" } });
  if (f.view === "mine" && userId) and.push({ assigneeId: userId });
  if (f.q) {
    const q = f.q;
    const num = q.match(/^(?:LE-?)?0*(\d{1,7})$/i);
    and.push({
      OR: [
        ...(num ? [{ number: Number(num[1]) }] : []),
        { suggestion: { contains: q, mode: "insensitive" } },
        { staffName: { contains: q, mode: "insensitive" } },
        { staffMessage: { contains: q, mode: "insensitive" } },
        { guestName: { contains: q, mode: "insensitive" } },
        { guestEmail: { contains: q, mode: "insensitive" } },
        { guestPhone: { contains: q } },
        { notes: { some: { body: { contains: q, mode: "insensitive" } } } },
      ],
    });
  }
  return and.length ? { AND: and } : {};
}

export const INBOX_ORDER: Prisma.FeedbackOrderByWithRelationInput[] = [{ pinned: "desc" }, { createdAt: "desc" }];

export function filtersToQuery(f: Filters, overrides: Partial<Filters> = {}) {
  const merged = { ...f, ...overrides };
  const p = new URLSearchParams();
  for (const k of FILTER_KEYS) if (merged[k]) p.set(k, merged[k]!);
  const s = p.toString();
  return s ? `?${s}` : "";
}
