import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { ROLE_LABELS, can, requireUser } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import {
  CATEGORIES, RATING_LABELS, feedbackRef, highlightLabel, improvementLabel, occasionLabel, sectionLabel,
} from "@/lib/config";
import { fmtDateTime, fmtVisitDate } from "@/lib/format";
import { Crowns, PageHeader, SentimentTag, StatusPill, UrgentTag } from "@/components/portal/ui";
import { ManagePanel, NoteForm, ReplyComposer } from "./Controls";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const f = await prisma.feedback.findUnique({ where: { id: (await params).id }, select: { number: true } });
  return { title: f ? feedbackRef(f.number) : "Feedback" };
}

export default async function FeedbackDetail({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const f = await prisma.feedback.findUnique({
    where: { id },
    include: {
      photos: { select: { id: true } },
      notes: { include: { author: { select: { name: true } } }, orderBy: { createdAt: "asc" } },
      replies: { include: { author: { select: { name: true } } }, orderBy: { createdAt: "asc" } },
      notifications: { orderBy: { createdAt: "asc" } },
      assignee: { select: { name: true } },
      reads: { include: { user: { select: { name: true } } }, orderBy: { readAt: "asc" } },
    },
  });
  if (!f) notFound();

  // Mark as read for this user; first open is logged.
  if (!f.reads.some((r) => r.userId === user.id)) {
    await prisma.feedbackRead.create({ data: { feedbackId: f.id, userId: user.id } }).catch(() => {});
    if (!f.firstReadAt) await prisma.feedback.update({ where: { id: f.id }, data: { firstReadAt: new Date() } });
    await logActivity(user.id, "feedback.viewed", feedbackRef(f.number));
  }

  const [managers, neighbours] = await Promise.all([
    prisma.user.findMany({ where: { active: true, role: { in: ["OWNER", "MANAGER"] } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    Promise.all([
      prisma.feedback.findFirst({ where: { number: { gt: f.number } }, orderBy: { number: "asc" }, select: { id: true } }),
      prisma.feedback.findFirst({ where: { number: { lt: f.number } }, orderBy: { number: "desc" }, select: { id: true } }),
    ]),
  ]);
  const [newer, older] = neighbours;
  const ref = feedbackRef(f.number);
  const where = `${sectionLabel(f.section)}${f.table ? ` · Table ${f.table}` : ""}`;
  const vars = {
    name: f.guestName?.split(" ")[0] || "Guest",
    date: fmtVisitDate(f.visitDate),
    section: sectionLabel(f.section),
    staff: f.staffName || "our team",
    sender: user.name,
    role: ROLE_LABELS[user.role] === "Owner" ? "Owner" : "Management",
  };

  const timeline = [
    { at: f.createdAt, text: `Received from ${f.guestName || "an anonymous guest"} (${f.language === "sw" ? "Kiswahili" : "English"}${f.durationSec ? `, ${Math.round(f.durationSec / 6) / 10} min to complete` : ""})` },
    ...f.notifications.map((n) => ({ at: n.createdAt, text: `${n.channel === "EMAIL" ? "Email" : n.channel === "SMS" ? "SMS" : "WhatsApp"} ${n.kind === "guest-reply" ? "to guest" : "alert to owner"} ${n.status.toLowerCase()}${n.error && n.status !== "SENT" ? ` — ${n.error}` : ""}`, tone: n.status === "FAILED" ? "bad" : undefined })),
    ...f.reads.map((r) => ({ at: r.readAt, text: `Opened by ${r.user.name}` })),
    ...f.replies.map((r) => ({ at: r.createdAt, text: `${r.author?.name ?? "Someone"} replied by ${r.channel === "EMAIL" ? "email" : "WhatsApp"}${r.status !== "SENT" ? ` (${r.status.toLowerCase()})` : ""}` })),
    ...(f.resolvedAt ? [{ at: f.resolvedAt, text: "Marked resolved" }] : []),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());

  return (
    <>
      <div className="no-print mb-4 flex items-center justify-between gap-2 text-sm">
        <Link href="/portal" className="text-muted hover:text-ink">← Inbox</Link>
        <div className="flex gap-2">
          {newer && <Link className="btn btn-ghost btn-sm" href={`/portal/feedback/${newer.id}`}>← Newer</Link>}
          {older && <Link className="btn btn-ghost btn-sm" href={`/portal/feedback/${older.id}`}>Older →</Link>}
        </div>
      </div>

      <PageHeader
        title={`${f.guestName || "Anonymous guest"}`}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <span>{ref}</span>·<span>{where}</span>·<span>{fmtDateTime(f.createdAt)}</span>
            <StatusPill status={f.status} />
            {f.urgent && <UrgentTag />}
            <SentimentTag s={f.sentiment} />
          </span>
        }
        actions={
          can(user, "export") ? (
            <a className="btn btn-ghost btn-sm" href={`/api/portal/feedback/${f.id}/pdf`}>⤓ PDF</a>
          ) : null
        }
      />

      {f.urgent && f.status !== "RESOLVED" && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-crimson/40 bg-crimson-soft px-4 py-3 text-crimson">
          <span className="pulse-dot mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-crimson" />
          <div className="text-sm">
            <b>Priority:</b> this guest rated their visit {f.overall}/5.
            {f.followUp ? " They asked management to follow up — please respond within the day." : " Review and resolve with the team."}
          </div>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          <section className="card p-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-4">
              <div className={`font-serif text-5xl font-semibold ${f.urgent ? "text-crimson" : "text-ink"}`}>{f.overall}<span className="text-2xl text-muted">/5</span></div>
              <div>
                <Crowns value={f.overall} size="md" />
                <div className="font-serif text-xl italic text-gold-ink">{RATING_LABELS.en[f.overall]}</div>
              </div>
              <div className="ml-auto text-right">
                <div className="label mb-0">Would recommend</div>
                <div className={`font-serif text-3xl font-semibold ${f.nps == null ? "text-muted" : f.nps >= 9 ? "text-green" : f.nps <= 6 ? "text-crimson" : "text-gold-ink"}`}>{f.nps ?? "—"}<span className="text-base text-muted">/10</span></div>
              </div>
            </div>
            {f.suggestion ? (
              <blockquote className="mt-5 border-l-2 border-gold bg-gold-soft/40 py-3 pr-3 pl-4 font-serif text-[1.25rem] leading-relaxed whitespace-pre-wrap">
                “{f.suggestion}”
              </blockquote>
            ) : (
              <p className="mt-5 text-sm text-muted italic">No written comment.</p>
            )}
          </section>

          <section className="card p-5 sm:p-6">
            <h2 className="mb-3 font-serif text-xl font-semibold">Ratings</h2>
            <dl className="grid gap-x-8 gap-y-2.5 sm:grid-cols-2">
              {CATEGORIES.map((c) => {
                const v = f[c.key as keyof typeof f] as number | null;
                return (
                  <div key={c.key} className="flex items-center justify-between border-b border-line/70 pb-2">
                    <dt className="text-sm">{c.en}</dt>
                    <dd className="flex items-center gap-2">
                      {v ? <><Crowns value={v} /><span className={`w-6 text-right text-sm font-semibold tabular-nums ${v <= 2 ? "text-crimson" : ""}`}>{v}</span></> : <span className="text-xs text-muted">Not rated</span>}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </section>

          <section className="card grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
            <div>
              <h2 className="mb-2 font-serif text-xl font-semibold">What stood out</h2>
              <div className="flex flex-wrap gap-1.5">
                {f.highlights.length ? f.highlights.map((h) => <span key={h} className="rounded-full border border-green/40 bg-green-soft px-3 py-1 text-sm text-green">{highlightLabel(h)}</span>) : <span className="text-sm text-muted">None selected</span>}
              </div>
            </div>
            <div>
              <h2 className="mb-2 font-serif text-xl font-semibold">Could be better</h2>
              <div className="flex flex-wrap gap-1.5">
                {f.improvements.length ? f.improvements.map((h) => <span key={h} className="rounded-full border border-crimson/40 bg-crimson-soft px-3 py-1 text-sm text-crimson">{improvementLabel(h)}</span>) : <span className="text-sm text-muted">None selected</span>}
              </div>
            </div>
          </section>

          {(f.staffName || f.staffMessage) && (
            <section className="card p-5 sm:p-6">
              <h2 className="mb-2 font-serif text-xl font-semibold">🌟 Staff recognition</h2>
              <p className="font-semibold">{f.staffName || "Name not given"}</p>
              {f.staffMessage && <p className="mt-1 font-serif text-lg italic">“{f.staffMessage}”</p>}
              <Link href={`/portal?staff=${encodeURIComponent(f.staffName ?? "")}`} className="mt-2 inline-block text-sm text-green underline-offset-4 hover:underline">All mentions of {f.staffName?.split(" ")[0]} →</Link>
            </section>
          )}

          {f.photos.length > 0 && (
            <section className="card p-5 sm:p-6">
              <h2 className="mb-3 font-serif text-xl font-semibold">Photos from the guest</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {f.photos.map((p) => (
                  <a key={p.id} href={`/api/portal/photo/${p.id}`} target="_blank" rel="noopener" className="block overflow-hidden rounded-lg border border-line">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/portal/photo/${p.id}`} alt="Guest photo" className="aspect-square w-full object-cover transition-transform hover:scale-105" loading="lazy" />
                  </a>
                ))}
              </div>
            </section>
          )}

          <section className="card p-5 sm:p-6">
            <h2 className="mb-3 font-serif text-xl font-semibold">Visit details</h2>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <Item k="Seating" v={where} />
              <Item k="Occasion" v={occasionLabel(f.occasion)} />
              <Item k="Date of visit" v={fmtVisitDate(f.visitDate)} />
              <Item k="Submitted" v={fmtDateTime(f.createdAt)} />
              <Item k="Language" v={f.language === "sw" ? "Kiswahili" : "English"} />
              <Item k="Reference" v={ref} />
            </dl>
          </section>
        </div>

        <aside className="space-y-5">
          <section className="card p-5">
            <h2 className="mb-3 font-serif text-xl font-semibold">Manage</h2>
            <ManagePanel id={f.id} status={f.status} starred={f.starred} pinned={f.pinned} assigneeId={f.assigneeId} managers={managers} canManage={can(user, "manage")} />
          </section>

          <section className="card p-5">
            <h2 className="mb-3 font-serif text-xl font-semibold">Guest contact</h2>
            <dl className="mb-4 space-y-2 text-sm">
              <Item k="Name" v={f.guestName || "Anonymous"} />
              {f.guestEmail && <Item k="Email" v={<a className="text-green" href={`mailto:${f.guestEmail}`}>{f.guestEmail}</a>} />}
              {f.guestPhone && <Item k="Phone" v={<a className="text-green" href={`tel:${f.guestPhone}`}>{f.guestPhone}</a>} />}
              <Item k="Follow-up requested" v={f.followUp ? <b className="text-crimson">Yes</b> : "No"} />
            </dl>
            {can(user, "reply") ? (
              <ReplyComposer id={f.id} email={f.guestEmail} phone={f.guestPhone} vars={vars} overall={f.overall} staffName={f.staffName} />
            ) : (
              <p className="text-xs text-muted">Your role can view but not reply.</p>
            )}
            {f.replies.length > 0 && (
              <div className="mt-4 space-y-3 border-t border-line pt-4">
                {f.replies.map((r) => (
                  <details key={r.id} className="text-sm">
                    <summary className="cursor-pointer">
                      <span className="font-medium">{r.channel === "EMAIL" ? "✉ Email" : "💬 WhatsApp"}</span> by {r.author?.name ?? "—"} · <span className="text-muted">{fmtDateTime(r.createdAt)}</span>
                      {r.status !== "SENT" && <span className="ml-1 text-crimson">({r.status.toLowerCase()})</span>}
                    </summary>
                    <p className="mt-2 rounded-lg bg-bg p-3 font-serif whitespace-pre-wrap">{r.body}</p>
                  </details>
                ))}
              </div>
            )}
          </section>

          <section className="card p-5">
            <h2 className="mb-3 font-serif text-xl font-semibold">Internal notes</h2>
            <ul className="mb-3 space-y-3">
              {f.notes.map((n) => (
                <li key={n.id} className="rounded-lg bg-gold-soft/50 p-3 text-sm">
                  <p className="whitespace-pre-wrap">{n.body}</p>
                  <p className="mt-1 text-xs text-muted">{n.author?.name ?? "Former user"} · {fmtDateTime(n.createdAt)}</p>
                </li>
              ))}
              {!f.notes.length && <li className="text-sm text-muted">No notes yet.</li>}
            </ul>
            {can(user, "manage") && <NoteForm id={f.id} />}
          </section>

          <section className="card p-5">
            <h2 className="mb-3 font-serif text-xl font-semibold">Timeline</h2>
            <ol className="space-y-2.5 border-l border-line pl-4 text-sm">
              {timeline.map((t, i) => (
                <li key={i} className="relative">
                  <span className={`absolute top-1.5 -left-[21px] h-2 w-2 rounded-full ${"tone" in t && t.tone === "bad" ? "bg-crimson" : "bg-gold"}`} />
                  <span className={"tone" in t && t.tone === "bad" ? "text-crimson" : ""}>{t.text}</span>
                  <div className="text-xs text-muted">{fmtDateTime(t.at)}</div>
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>
    </>
  );
}

function Item({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs tracking-wide text-muted uppercase">{k}</dt>
      <dd className="mt-0.5">{v}</dd>
    </div>
  );
}
