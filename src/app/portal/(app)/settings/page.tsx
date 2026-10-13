import Link from "next/link";
import { prisma } from "@/lib/db";
import { can, requireUser } from "@/lib/auth";
import { appUrl, feedbackRef, guestLinks } from "@/lib/config";
import { fmtDateTime } from "@/lib/format";
import { ownerEmails, ownerPhone } from "@/lib/notify";
import { PageHeader } from "@/components/portal/ui";
import { Password, Prefs, Profile, RetryButton, TwoFactor } from "./SettingsClient";

export const metadata = { title: "Settings" };

export default async function Settings() {
  const user = await requireUser();
  const me = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  const isOwner = can(user, "users");
  const log = await prisma.notificationLog.findMany({ orderBy: { createdAt: "desc" }, take: 40, include: { feedback: { select: { number: true, id: true } } } });
  const links = guestLinks();
  const channels = [
    { name: "Email (Resend)", ok: !!process.env.RESEND_API_KEY, detail: `Instant alerts → ${ownerEmails().join(", ") || "OWNER_NOTIFY_EMAILS not set"}` },
    { name: "WhatsApp Business", ok: !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID && ownerPhone()), detail: ownerPhone() ? `Summary alerts → +${ownerPhone()}` : "OWNER_ALERT_PHONE not set" },
    { name: "SMS (Africa's Talking)", ok: !!(process.env.AT_USERNAME && process.env.AT_API_KEY && ownerPhone()), detail: process.env.SMS_ALERTS === "all" ? "Every submission" : "Urgent submissions only" },
    { name: "Scheduled digests", ok: !!process.env.CRON_SECRET, detail: "Cron calls /api/cron/digest" },
    { name: "Google review link", ok: !links.googleReviewIsPlaceholder, detail: links.googleReviewIsPlaceholder ? "Using a Google Maps search until GOOGLE_REVIEW_URL is set" : links.googleReview },
  ];

  return (
    <>
      <PageHeader title="Settings" subtitle={`${me.email}`} />
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card p-5"><h2 className="mb-3 font-serif text-xl font-semibold">Profile</h2><Profile name={me.name} /></section>
        <section className="card p-5"><h2 className="mb-3 font-serif text-xl font-semibold">Password</h2><Password /></section>
        <section className="card p-5"><h2 className="mb-3 font-serif text-xl font-semibold">Two-factor authentication</h2><TwoFactor enabled={me.totpEnabled} /></section>
        <section className="card p-5">
          <h2 className="mb-1 font-serif text-xl font-semibold">Notifications</h2>
          <Prefs initial={{ notifyInstant: me.notifyInstant, digestDaily: me.digestDaily, digestWeekly: me.digestWeekly, digestMonthly: me.digestMonthly }} />
        </section>
      </div>

      {isOwner && (
        <section className="card mt-5 p-5">
          <h2 className="mb-3 font-serif text-xl font-semibold">Delivery channels</h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {channels.map((c) => (
              <li key={c.name} className="flex items-start gap-3 rounded-lg border border-line p-3 text-sm">
                <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${c.ok ? "bg-green" : "bg-gold"}`} />
                <span><b>{c.name}</b> · {c.ok ? "connected" : "not configured"}<br /><span className="text-muted">{c.detail}</span></span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted">Configured through environment variables — see SETUP.md. Guest site: <a className="text-green underline" href={`${appUrl()}/feedback`} target="_blank" rel="noopener">{appUrl()}/feedback</a></p>
        </section>
      )}

      <section className="card mt-5 overflow-hidden">
        <h2 className="px-5 pt-5 pb-3 font-serif text-xl font-semibold">Delivery log</h2>
        <p className="px-5 pb-3 text-sm text-muted">Every alert, digest and guest reply the system has tried to send. Skipped means the channel isn&apos;t configured yet — the feedback itself is always safely stored.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-y border-line text-xs tracking-wide text-muted uppercase"><tr><th className="px-5 py-2">When</th><th className="px-3 py-2">Channel</th><th className="px-3 py-2">Type</th><th className="px-3 py-2">To</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Feedback</th></tr></thead>
            <tbody className="divide-y divide-line">
              {log.map((l) => (
                <tr key={l.id}>
                  <td className="px-5 py-2 whitespace-nowrap text-muted">{fmtDateTime(l.createdAt)}</td>
                  <td className="px-3 py-2">{l.channel}</td>
                  <td className="px-3 py-2">{l.kind}</td>
                  <td className="max-w-52 truncate px-3 py-2" title={l.to}>{l.to}</td>
                  <td className="px-3 py-2">
                    <span className={l.status === "SENT" ? "text-green" : l.status === "FAILED" ? "text-crimson" : "text-gold-ink"} title={l.error ?? ""}>{l.status.toLowerCase()}</span>
                    {l.status === "FAILED" && l.feedback && l.kind.startsWith("instant") && <span className="ml-2"><RetryButton feedbackId={l.feedback.id} /></span>}
                  </td>
                  <td className="px-3 py-2">{l.feedback ? <Link className="text-green underline" href={`/portal/feedback/${l.feedback.id}`}>{feedbackRef(l.feedback.number)}</Link> : "—"}</td>
                </tr>
              ))}
              {!log.length && <tr><td colSpan={6} className="px-5 py-6 text-center text-muted">Nothing sent yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
