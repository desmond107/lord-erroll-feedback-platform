import "server-only";
import type { Feedback } from "@prisma/client";
import {
  RESTAURANT, CATEGORIES, RATING_LABELS, URGENT_THRESHOLD, appUrl, feedbackRef,
  highlightLabel, improvementLabel, occasionLabel, sectionLabel,
} from "./config";
import { fmtDateTime, fmtVisitDate } from "./format";

const C = { green: "#1F5E3A", crimson: "#A32A2A", gold: "#C9A24B", ivory: "#FAF5EA", ink: "#1F2421", muted: "#6B6A63", line: "#E8DFC9" };

export const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const crowns = (n: number) => "♛".repeat(n) + `<span style="color:${C.line}">${"♛".repeat(5 - n)}</span>`;
const crownsText = (n: number) => "★".repeat(n) + "☆".repeat(5 - n);

export function layout(opts: { preheader: string; body: string; banner?: { text: string; color: string } }) {
  const crest = `${appUrl()}/brand/crest-240.png`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta name="color-scheme" content="light only"></head>
<body style="margin:0;padding:0;background:${C.ivory};font-family:Helvetica,Arial,sans-serif;color:${C.ink}">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(opts.preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.ivory}"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;background:#ffffff;border:1px solid ${C.line};border-radius:6px">
<tr><td align="center" style="padding:28px 24px 12px"><img src="${crest}" width="64" alt="The Lord Erroll crest" style="display:block;border:0;height:auto">
<div style="font-family:Georgia,'Times New Roman',serif;font-size:22px;color:${C.green};margin-top:10px;letter-spacing:.5px">The Lord Erroll</div>
<div style="font-size:11px;letter-spacing:3px;text-transform:uppercase;color:${C.gold};margin-top:2px">Gourmet Restaurant</div>
<div style="height:1px;background:${C.gold};width:80px;margin:16px auto 0"></div></td></tr>
${opts.banner ? `<tr><td style="padding:0 24px"><div style="background:${opts.banner.color};color:#fff;font-weight:bold;font-size:13px;letter-spacing:1px;text-transform:uppercase;padding:10px 14px;border-radius:4px;text-align:center">${esc(opts.banner.text)}</div></td></tr>` : ""}
<tr><td style="padding:16px 28px 28px;font-size:15px;line-height:1.6">${opts.body}</td></tr>
<tr><td style="padding:18px 28px;border-top:1px solid ${C.line};font-size:12px;color:${C.muted};text-align:center">
${esc(RESTAURANT.fullName)} · ${esc(RESTAURANT.address)}<br>${esc(RESTAURANT.phone)} · <a href="mailto:${RESTAURANT.email}" style="color:${C.green}">${RESTAURANT.email}</a> · <a href="${RESTAURANT.websiteHref}" style="color:${C.green}">${RESTAURANT.website}</a>
</td></tr></table></td></tr></table></body></html>`;
}

const button = (href: string, label: string, color = C.green) =>
  `<a href="${href}" style="display:inline-block;background:${color};color:#fff;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:4px;font-size:14px">${esc(label)}</a>`;

const row = (k: string, v: string) =>
  `<tr><td style="padding:6px 0;color:${C.muted};font-size:13px;width:42%;vertical-align:top">${esc(k)}</td><td style="padding:6px 0;font-size:14px;vertical-align:top">${v}</td></tr>`;

const sectionHead = (t: string) =>
  `<div style="font-family:Georgia,serif;font-size:17px;color:${C.green};margin:22px 0 6px;border-bottom:1px solid ${C.line};padding-bottom:6px">${esc(t)}</div>`;

export type FeedbackForEmail = Feedback & { photoCount: number };

export function feedbackLink(f: { id: string }) {
  return `${appUrl()}/portal/feedback/${f.id}`;
}

export function shortSummary(f: Feedback) {
  const where = [sectionLabel(f.section), f.table ? `T${f.table}` : null].filter(Boolean).join(" ");
  const comment = (f.suggestion || f.staffMessage || "").replace(/\s+/g, " ").trim();
  const urgent = f.overall <= URGENT_THRESHOLD ? "URGENT " : "";
  return `${urgent}Lord Erroll feedback ${feedbackRef(f.number)}: ${f.overall}/5 ${RATING_LABELS.en[f.overall]} · ${where}${f.followUp ? " · follow-up requested" : ""}${comment ? ` · "${comment.slice(0, 90)}${comment.length > 90 ? "…" : ""}"` : ""} · ${feedbackLink(f)}`;
}

export function newFeedbackEmail(f: FeedbackForEmail) {
  const urgent = f.overall <= URGENT_THRESHOLD;
  const ref = feedbackRef(f.number);
  const where = `${sectionLabel(f.section)}${f.table ? `, Table ${f.table}` : ""}`;
  const subject = urgent
    ? `URGENT · ${f.overall}/5 from ${where}${f.followUp ? " · guest requests follow-up" : ""} · ${ref}`
    : `${crownsText(f.overall)} New feedback from ${where} · ${ref}`;

  const ratingRows = CATEGORIES.map((c) => {
    const v = f[c.key as keyof Feedback] as number | null;
    return row(c.en, v ? `<span style="color:${C.gold};font-size:16px">${crowns(v)}</span> ${v}/5` : `<span style="color:${C.muted}">Not rated</span>`);
  }).join("");

  const chips = (keys: string[], label: (k: string) => string, color: string) =>
    keys.length
      ? keys.map((k) => `<span style="display:inline-block;border:1px solid ${color};color:${color};border-radius:999px;padding:3px 10px;margin:0 4px 6px 0;font-size:12px">${esc(label(k))}</span>`).join("")
      : `<span style="color:${C.muted}">None selected</span>`;

  const guest = f.guestName || f.guestEmail || f.guestPhone;
  const body = `
<p style="margin:0 0 4px;font-size:13px;color:${C.muted}">${esc(ref)} · received ${esc(fmtDateTime(f.createdAt))}</p>
<div style="font-family:Georgia,serif;font-size:24px;margin:4px 0 2px;color:${urgent ? C.crimson : C.ink}">
  <span style="color:${C.gold}">${crowns(f.overall)}</span> ${esc(RATING_LABELS.en[f.overall])}
</div>
<p style="margin:0 0 18px;color:${C.muted}">${esc(guest ? f.guestName || "Guest" : "Anonymous guest")} · ${esc(where)} · ${esc(occasionLabel(f.occasion))} · visited ${esc(fmtVisitDate(f.visitDate))}</p>
${f.suggestion ? `${sectionHead("In their words")}<blockquote style="margin:0;padding:10px 14px;border-left:3px solid ${C.gold};background:${C.ivory};font-family:Georgia,serif;font-size:16px;white-space:pre-wrap">${esc(f.suggestion)}</blockquote>` : ""}
${sectionHead("Ratings")}<table role="presentation" width="100%">${ratingRows}${row("Would recommend (0–10)", f.nps != null ? `<b>${f.nps}</b>` : `<span style="color:${C.muted}">Not answered</span>`)}</table>
${sectionHead("What stood out")}${chips(f.highlights, highlightLabel, C.green)}
${sectionHead("What could be better")}${chips(f.improvements, improvementLabel, C.crimson)}
${f.staffName || f.staffMessage ? `${sectionHead("Staff recognition")}<p style="margin:0"><b>${esc(f.staffName || "Unnamed")}</b>${f.staffMessage ? ` — “${esc(f.staffMessage)}”` : ""}</p>` : ""}
${sectionHead("Guest contact")}<table role="presentation" width="100%">
${row("Name", esc(f.guestName || "Anonymous"))}
${f.guestEmail ? row("Email", `<a href="mailto:${esc(f.guestEmail)}" style="color:${C.green}">${esc(f.guestEmail)}</a>`) : ""}
${f.guestPhone ? row("Phone", `<a href="tel:${esc(f.guestPhone)}" style="color:${C.green}">${esc(f.guestPhone)}</a>`) : ""}
${row("Follow-up requested", f.followUp ? `<b style="color:${C.crimson}">Yes — please respond</b>` : "No")}
${row("Photos", f.photoCount ? `${f.photoCount} attached (view in portal)` : "None")}
${row("Language", f.language === "sw" ? "Kiswahili" : "English")}
</table>
<p style="text-align:center;margin:28px 0 4px">${button(feedbackLink(f), urgent ? "Open and respond now" : "Open in owner portal", urgent ? C.crimson : C.green)}</p>`;

  const text = [
    `${urgent ? "URGENT — " : ""}${ref} · ${f.overall}/5 ${RATING_LABELS.en[f.overall]}`,
    `${where} · ${occasionLabel(f.occasion)} · visited ${fmtVisitDate(f.visitDate)}`,
    f.suggestion ? `\n"${f.suggestion}"\n` : "",
    ...CATEGORIES.map((c) => `${c.en}: ${(f[c.key as keyof Feedback] as number | null) ?? "—"}/5`),
    `Recommend: ${f.nps ?? "—"}/10`,
    `Stood out: ${f.highlights.map(highlightLabel).join(", ") || "—"}`,
    `Could be better: ${f.improvements.map(improvementLabel).join(", ") || "—"}`,
    f.staffName ? `Staff: ${f.staffName}${f.staffMessage ? ` — "${f.staffMessage}"` : ""}` : "",
    `Guest: ${f.guestName || "Anonymous"} ${f.guestEmail || ""} ${f.guestPhone || ""}`.trim(),
    `Follow-up requested: ${f.followUp ? "YES" : "no"}`,
    `\nOpen: ${feedbackLink(f)}`,
  ].filter(Boolean).join("\n");

  return {
    subject,
    html: layout({
      preheader: f.suggestion?.slice(0, 120) || `${RATING_LABELS.en[f.overall]} · ${where}`,
      body,
      banner: urgent ? { text: `Priority alert · ${f.overall}/5${f.followUp ? " · follow-up requested" : ""}`, color: C.crimson } : undefined,
    }),
    text,
  };
}

export type DigestData = {
  label: string;
  periodText: string;
  total: number;
  avgOverall: number | null;
  nps: number | null;
  urgent: number;
  open: number;
  bySection: { label: string; count: number; avg: number | null }[];
  topStaff: { name: string; count: number }[];
  items: Feedback[];
};

export function digestEmail(d: DigestData) {
  const stat = (k: string, v: string, color = C.ink) =>
    `<td align="center" style="padding:10px;border:1px solid ${C.line}"><div style="font-family:Georgia,serif;font-size:24px;color:${color}">${esc(v)}</div><div style="font-size:11px;color:${C.muted};text-transform:uppercase;letter-spacing:1px">${esc(k)}</div></td>`;
  const items = d.items
    .slice(0, 25)
    .map(
      (f) => `<tr><td style="padding:8px 0;border-bottom:1px solid ${C.line};font-size:13px">
<a href="${feedbackLink(f)}" style="color:${f.overall <= URGENT_THRESHOLD ? C.crimson : C.green};font-weight:bold;text-decoration:none">${feedbackRef(f.number)} · ${f.overall}/5</a>
<span style="color:${C.muted}"> · ${esc(sectionLabel(f.section))}${f.table ? ` T${esc(f.table)}` : ""} · ${esc(f.guestName || "Anonymous")}</span>
${f.suggestion ? `<div style="color:${C.ink};margin-top:2px">${esc(f.suggestion.slice(0, 160))}${f.suggestion.length > 160 ? "…" : ""}</div>` : ""}</td></tr>`,
    )
    .join("");
  const body = `
<div style="font-family:Georgia,serif;font-size:22px;margin:0 0 2px">${esc(d.label)}</div>
<p style="margin:0 0 16px;color:${C.muted}">${esc(d.periodText)}</p>
<table role="presentation" width="100%" cellspacing="0" style="border-collapse:collapse"><tr>
${stat("Responses", String(d.total))}${stat("Avg rating", d.avgOverall ? d.avgOverall.toFixed(2) : "—", C.green)}${stat("NPS", d.nps == null ? "—" : String(d.nps), C.green)}${stat("Urgent", String(d.urgent), d.urgent ? C.crimson : C.ink)}
</tr></table>
${d.open ? `<p style="margin:14px 0 0;color:${C.crimson}"><b>${d.open}</b> item${d.open === 1 ? " is" : "s are"} still awaiting resolution.</p>` : ""}
${sectionHead("By seating area")}<table role="presentation" width="100%">${d.bySection.map((s) => row(s.label, `${s.count} response${s.count === 1 ? "" : "s"} · avg ${s.avg ? s.avg.toFixed(1) : "—"}`)).join("")}</table>
${d.topStaff.length ? `${sectionHead("Staff mentioned")}<table role="presentation" width="100%">${d.topStaff.map((s) => row(s.name, `${s.count} mention${s.count === 1 ? "" : "s"}`)).join("")}</table>` : ""}
${d.items.length ? `${sectionHead("Feedback received")}<table role="presentation" width="100%">${items}</table>${d.items.length > 25 ? `<p style="color:${C.muted};font-size:13px">…and ${d.items.length - 25} more in the portal.</p>` : ""}` : `<p style="color:${C.muted}">No feedback was received in this period.</p>`}
<p style="text-align:center;margin:26px 0 4px">${button(`${appUrl()}/portal`, "Open the owner portal")}</p>`;
  return {
    subject: `${d.label}: ${d.total} response${d.total === 1 ? "" : "s"}, avg ${d.avgOverall ? d.avgOverall.toFixed(1) : "—"}${d.urgent ? `, ${d.urgent} urgent` : ""}`,
    html: layout({ preheader: `${d.total} responses · ${d.periodText}`, body }),
    text: `${d.label} (${d.periodText})\nResponses: ${d.total}\nAverage: ${d.avgOverall?.toFixed(2) ?? "—"}\nNPS: ${d.nps ?? "—"}\nUrgent: ${d.urgent}\n\n${appUrl()}/portal`,
  };
}

export function guestReplyEmail(subject: string, bodyText: string) {
  const html = layout({
    preheader: bodyText.slice(0, 120),
    body: bodyText
      .split(/\n{2,}/)
      .map((p) => `<p style="margin:0 0 14px;font-family:Georgia,serif;font-size:16px">${esc(p).replace(/\n/g, "<br>")}</p>`)
      .join(""),
  });
  return { subject, html, text: bodyText };
}
