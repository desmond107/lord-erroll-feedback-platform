import Link from "next/link";
import { prisma } from "@/lib/db";
import { can, requireUser } from "@/lib/auth";
import { buildWhere, filtersToQuery, INBOX_ORDER, readFilters } from "@/lib/feedback-query";
import { feedbackRef, occasionLabel, sectionLabel } from "@/lib/config";
import { fmtDateTime, fmtRelative } from "@/lib/format";
import { counts } from "@/lib/portal-data";
import FilterBar from "@/components/portal/FilterBar";
import ExportMenu from "@/components/portal/ExportMenu";
import { Empty, PageHeader, RatingBadge, StatusPill, UrgentTag } from "@/components/portal/ui";

export const metadata = { title: "Inbox" };
const PAGE_SIZE = 25;

export default async function Inbox({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const f = readFilters(sp);
  const page = Math.max(1, Number(f.page) || 1);
  const where = buildWhere(f, user.id);
  const [items, total, c, today] = await Promise.all([
    prisma.feedback.findMany({
      where,
      orderBy: INBOX_ORDER,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        reads: { where: { userId: user.id }, select: { userId: true } },
        assignee: { select: { name: true } },
        _count: { select: { photos: true, notes: true } },
      },
    }),
    prisma.feedback.count({ where }),
    counts(user.id),
    prisma.feedback.count({ where: { createdAt: { gte: new Date(Date.now() - 86400e3) } } }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const exportQuery = filtersToQuery({ ...f, page: undefined });

  const views: { key?: string; label: string; count?: number; extra?: Record<string, string> }[] = [
    { label: "All" },
    { key: "unread", label: "Unread", count: c.unread },
    { key: "urgent", label: "Urgent", count: c.urgentOpen },
    { key: "followup", label: "Follow-up requested", count: c.followUps },
    { key: "starred", label: "Starred" },
    { key: "mine", label: "Assigned to me" },
  ];
  const viewHref = (k?: string) => (k === "urgent" ? "/portal?rating=urgent&status=OPEN" : k ? `/portal?view=${k}` : "/portal");
  const isActive = (k?: string) => (k === "urgent" ? f.rating === "urgent" && !f.view : k ? f.view === k : !f.view && f.rating !== "urgent");

  return (
    <>
      <PageHeader
        title="Guest feedback"
        subtitle={
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-green" aria-hidden />
            Live · {today} in the last 24 hours · {total} matching
          </span>
        }
        actions={can(user, "export") ? <ExportMenu query={exportQuery} label="Export list" /> : null}
      />

      <div className="no-print scrollbar-thin -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {views.map((v) => (
          <Link
            key={v.label}
            href={viewHref(v.key)}
            className={`flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
              isActive(v.key) ? "border-green bg-green text-on-accent" : "border-line bg-surface hover:border-gold"
            }`}
          >
            {v.label}
            {!!v.count && (
              <span className={`rounded-full px-1.5 text-xs font-semibold tabular-nums ${isActive(v.key) ? "bg-white/20" : v.key === "urgent" ? "bg-crimson text-white" : "bg-gold-soft text-gold-ink"}`}>
                {v.count}
              </span>
            )}
          </Link>
        ))}
      </div>

      <FilterBar filters={f} />

      {items.length === 0 ? (
        <Empty title={total === 0 && !Object.keys(f).length ? "No feedback yet" : "Nothing matches"}>
          {Object.keys(f).length ? "Try clearing a filter or two." : "When guests scan a table QR code and share their thoughts, each one arrives here instantly."}
        </Empty>
      ) : (
        <ul className="card divide-y divide-line overflow-hidden">
          {items.map((it) => {
            const unread = it.reads.length === 0;
            const preview = it.suggestion || it.staffMessage || (it.highlights.length || it.improvements.length ? "Ratings and selections only" : "Ratings only");
            return (
              <li key={it.id} className={`relative ${it.urgent && it.status !== "RESOLVED" ? "bg-crimson-soft/50" : unread ? "bg-gold-soft/35" : ""}`}>
                {it.urgent && it.status !== "RESOLVED" && <span className="absolute inset-y-0 left-0 w-1 bg-crimson" aria-hidden />}
                <Link href={`/portal/feedback/${it.id}`} className="flex gap-3 px-4 py-4 transition-colors hover:bg-gold-soft/60 sm:gap-4 sm:px-5">
                  <div className="flex flex-col items-center gap-2 pt-0.5">
                    <RatingBadge value={it.overall} />
                    {unread && <span className="h-2 w-2 rounded-full bg-crimson" title="Unread" aria-label="Unread" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className={`truncate ${unread ? "font-semibold" : "font-medium"}`}>{it.guestName || <span className="text-muted italic">Anonymous</span>}</span>
                      {it.urgent && <UrgentTag />}
                      {it.followUp && it.status !== "RESOLVED" && <span className="rounded-full border border-crimson/40 px-2 py-0.5 text-[0.68rem] text-crimson">Follow-up requested</span>}
                      {it.pinned && <span title="Pinned" aria-label="Pinned">📌</span>}
                      {it.starred && <span className="text-gold" title="Starred" aria-label="Starred">★</span>}
                    </div>
                    <div className="mt-0.5 text-xs text-muted">
                      {feedbackRef(it.number)} · {sectionLabel(it.section)}
                      {it.table ? ` · Table ${it.table}` : ""}
                      {it.occasion ? ` · ${occasionLabel(it.occasion)}` : ""}
                    </div>
                    <p className={`mt-1.5 line-clamp-2 text-[0.93rem] ${it.suggestion ? "" : "text-muted italic"}`}>{preview}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                      <StatusPill status={it.status} />
                      {it.assignee && <span>→ {it.assignee.name}</span>}
                      {it._count.photos > 0 && <span>📷 {it._count.photos}</span>}
                      {it._count.notes > 0 && <span>✎ {it._count.notes}</span>}
                      {it.staffName && <span>🌟 {it.staffName}</span>}
                    </div>
                  </div>
                  <time className="shrink-0 text-right text-xs text-muted" dateTime={it.createdAt.toISOString()} title={fmtDateTime(it.createdAt)}>
                    {fmtRelative(it.createdAt)}
                  </time>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {pages > 1 && (
        <nav className="no-print mt-5 flex items-center justify-between text-sm" aria-label="Pagination">
          {page > 1 ? <Link className="btn btn-ghost btn-sm" href={`/portal${filtersToQuery(f, { page: String(page - 1) })}`}>← Newer</Link> : <span />}
          <span className="text-muted">Page {page} of {pages}</span>
          {page < pages ? <Link className="btn btn-ghost btn-sm" href={`/portal${filtersToQuery(f, { page: String(page + 1) })}`}>Older →</Link> : <span />}
        </nav>
      )}
    </>
  );
}
