import "server-only";
import fs from "fs/promises";
import path from "path";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage, type RGB } from "pdf-lib";
import type { Feedback, FeedbackPhoto, Note, Reply, User } from "@prisma/client";
import {
  CATEGORIES, RATING_LABELS, RESTAURANT, feedbackRef, highlightLabel, improvementLabel, occasionLabel, sectionLabel,
} from "./config";
import { fmtDate, fmtDateTime, fmtVisitDate } from "./format";
import type { getInsights, getQrStats } from "./stats";

const hex = (h: string) => rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255);
const C = { green: hex("#1F5E3A"), crimson: hex("#A32A2A"), gold: hex("#C9A24B"), goldInk: hex("#87661C"), ink: hex("#1F2421"), muted: hex("#6B6A63"), line: hex("#E6DCC4"), ivory: hex("#FAF5EA"), white: rgb(1, 1, 1) };

const A4 = { w: 595.28, h: 841.89 };
const M = 48;

// Standard PDF fonts only cover WinAnsi; swap or drop anything else so text never throws.
const CP1252 = new Set("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ");
function safe(s: unknown) {
  return String(s ?? "")
    .replace(/[★♛]/g, "*").replace(/[☆]/g, "-").replace(/[≤]/g, "<=").replace(/[≥]/g, ">=").replace(/[→]/g, "->").replace(/\t/g, "  ")
    .split("")
    .filter((ch) => {
      const c = ch.charCodeAt(0);
      return ch === "\n" || (c >= 32 && c <= 126) || (c >= 160 && c <= 255) || CP1252.has(ch);
    })
    .join("");
}

async function crestBytes() {
  return fs.readFile(path.join(process.cwd(), "public", "brand", "crest-240.png"));
}

class Doc {
  doc!: PDFDocument;
  serif!: PDFFont;
  serifBold!: PDFFont;
  serifItalic!: PDFFont;
  sans!: PDFFont;
  sansBold!: PDFFont;
  crest!: PDFImage;
  page!: PDFPage;
  y = 0;
  pageNo = 0;
  constructor(public title: string, public subtitle: string) {}

  async init() {
    this.doc = await PDFDocument.create();
    this.doc.setTitle(`${this.title} · ${RESTAURANT.fullName}`);
    this.doc.setAuthor(RESTAURANT.fullName);
    this.doc.setCreator("Lord Erroll Feedback Portal");
    this.serif = await this.doc.embedFont(StandardFonts.TimesRoman);
    this.serifBold = await this.doc.embedFont(StandardFonts.TimesRomanBold);
    this.serifItalic = await this.doc.embedFont(StandardFonts.TimesRomanItalic);
    this.sans = await this.doc.embedFont(StandardFonts.Helvetica);
    this.sansBold = await this.doc.embedFont(StandardFonts.HelveticaBold);
    this.crest = await this.doc.embedPng(await crestBytes());
    this.newPage();
    return this;
  }

  newPage() {
    this.page = this.doc.addPage([A4.w, A4.h]);
    this.pageNo++;
    const p = this.page;
    // Header band with crest.
    const ch = 46, cw = (ch * this.crest.width) / this.crest.height;
    p.drawImage(this.crest, { x: M, y: A4.h - M - ch + 6, width: cw, height: ch });
    p.drawText("The Lord Erroll", { x: M + cw + 12, y: A4.h - M - 12, size: 18, font: this.serifBold, color: C.green });
    p.drawText("GOURMET RESTAURANT", { x: M + cw + 12, y: A4.h - M - 25, size: 7.5, font: this.sans, color: C.goldInk });
    const t = safe(this.title);
    p.drawText(t, { x: A4.w - M - this.serifBold.widthOfTextAtSize(t, 13), y: A4.h - M - 12, size: 13, font: this.serifBold, color: C.ink });
    const st = safe(this.subtitle);
    p.drawText(st, { x: A4.w - M - this.sans.widthOfTextAtSize(st, 8), y: A4.h - M - 25, size: 8, font: this.sans, color: C.muted });
    p.drawLine({ start: { x: M, y: A4.h - M - 40 }, end: { x: A4.w - M, y: A4.h - M - 40 }, thickness: 0.8, color: C.gold });
    // Footer.
    const foot = safe(`${RESTAURANT.fullName} · ${RESTAURANT.address} · ${RESTAURANT.phone} · ${RESTAURANT.website}`);
    p.drawText(foot, { x: M, y: 28, size: 7, font: this.sans, color: C.muted });
    const pn = `Page ${this.pageNo}`;
    p.drawText(pn, { x: A4.w - M - this.sans.widthOfTextAtSize(pn, 7), y: 28, size: 7, font: this.sans, color: C.muted });
    p.drawText("Confidential — internal use", { x: A4.w / 2 - 45, y: 18, size: 6, font: this.sans, color: C.muted });
    this.y = A4.h - M - 62;
  }

  ensure(h: number) {
    if (this.y - h < 52) this.newPage();
  }

  wrap(text: string, font: PDFFont, size: number, width: number) {
    const out: string[] = [];
    for (const para of safe(text).split("\n")) {
      let line = "";
      for (const word of para.split(/\s+/)) {
        const tryLine = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(tryLine, size) <= width) line = tryLine;
        else {
          if (line) out.push(line);
          // Hard-break very long words.
          let w = word;
          while (font.widthOfTextAtSize(w, size) > width) {
            let i = w.length;
            while (i > 1 && font.widthOfTextAtSize(w.slice(0, i), size) > width) i--;
            out.push(w.slice(0, i));
            w = w.slice(i);
          }
          line = w;
        }
      }
      out.push(line);
    }
    return out;
  }

  text(text: string, o: { font?: PDFFont; size?: number; color?: RGB; x?: number; width?: number; gap?: number } = {}) {
    const font = o.font ?? this.sans, size = o.size ?? 10, x = o.x ?? M, width = o.width ?? A4.w - M - x;
    const lh = size * 1.35;
    for (const line of this.wrap(text, font, size, width)) {
      this.ensure(lh);
      this.page.drawText(line, { x, y: this.y - size, size, font, color: o.color ?? C.ink });
      this.y -= lh;
    }
    this.y -= o.gap ?? 4;
  }

  heading(t: string) {
    this.ensure(34);
    this.y -= 8;
    this.page.drawText(safe(t), { x: M, y: this.y - 14, size: 14, font: this.serifBold, color: C.green });
    this.y -= 20;
    this.page.drawLine({ start: { x: M, y: this.y }, end: { x: A4.w - M, y: this.y }, thickness: 0.5, color: C.line });
    this.y -= 8;
  }

  kv(k: string, v: string, color?: RGB) {
    const kw = 150;
    const lines = this.wrap(v || "—", this.sans, 10, A4.w - 2 * M - kw);
    this.ensure(lines.length * 13.5 + 2);
    this.page.drawText(safe(k), { x: M, y: this.y - 10, size: 9, font: this.sans, color: C.muted });
    lines.forEach((l, i) => this.page.drawText(l, { x: M + kw, y: this.y - 10 - i * 13.5, size: 10, font: this.sans, color: color ?? C.ink }));
    this.y -= lines.length * 13.5 + 3;
  }

  crowns(x: number, y: number, n: number, size = 9) {
    for (let i = 0; i < 5; i++) {
      this.page.drawCircle({ x: x + i * (size + 3) + size / 2, y: y + size / 2 - 1, size: size / 2, color: i < n ? C.gold : C.line });
    }
  }

  bar(label: string, value: number | null, max: number, opts: { suffix?: string; color?: RGB; labelWidth?: number } = {}) {
    const lw = opts.labelWidth ?? 130, bw = A4.w - 2 * M - lw - 60;
    this.ensure(18);
    this.page.drawText(safe(label), { x: M, y: this.y - 10, size: 9, font: this.sans, color: C.ink });
    this.page.drawRectangle({ x: M + lw, y: this.y - 11, width: bw, height: 9, color: C.ivory });
    if (value != null && max > 0) this.page.drawRectangle({ x: M + lw, y: this.y - 11, width: Math.max(1, (bw * value) / max), height: 9, color: opts.color ?? C.green });
    const vt = value == null ? "—" : `${Number.isInteger(value) ? value : value.toFixed(2)}${opts.suffix ?? ""}`;
    this.page.drawText(vt, { x: M + lw + bw + 8, y: this.y - 10, size: 9, font: this.sansBold, color: C.ink });
    this.y -= 17;
  }

  async save() {
    return Buffer.from(await this.doc.save());
  }
}

export type FeedbackFull = Feedback & {
  photos: Pick<FeedbackPhoto, "id" | "mime" | "data">[];
  notes: (Note & { author: Pick<User, "name"> | null })[];
  replies: (Reply & { author: Pick<User, "name"> | null })[];
  assignee: Pick<User, "name"> | null;
};

function guestLabel(f: Feedback) {
  return f.guestName || (f.guestEmail || f.guestPhone ? "Guest (no name)" : "Anonymous");
}

async function writeFeedback(d: Doc, f: FeedbackFull) {
  d.ensure(80);
  d.page.drawText(safe(`${feedbackRef(f.number)} · ${RATING_LABELS.en[f.overall]}`), { x: M, y: d.y - 20, size: 20, font: d.serifBold, color: f.urgent ? C.crimson : C.ink });
  d.crowns(A4.w - M - 5 * 15, d.y - 20, f.overall, 12);
  d.y -= 30;
  d.text(`${guestLabel(f)} · ${sectionLabel(f.section)}${f.table ? `, Table ${f.table}` : ""} · ${occasionLabel(f.occasion)} · received ${fmtDateTime(f.createdAt)}`, { color: C.muted, size: 9.5 });
  if (f.urgent) {
    d.ensure(22);
    d.page.drawRectangle({ x: M, y: d.y - 18, width: A4.w - 2 * M, height: 18, color: C.crimson });
    d.page.drawText(safe(`URGENT · ${f.overall}/5${f.followUp ? " · guest requested follow-up" : ""}`), { x: M + 8, y: d.y - 13, size: 9, font: d.sansBold, color: C.white });
    d.y -= 26;
  }
  if (f.suggestion) {
    d.heading("In the guest's words");
    d.text(`"${f.suggestion}"`, { font: d.serifItalic, size: 12.5 });
  }
  d.heading("Ratings");
  for (const c of CATEGORIES) {
    const v = f[c.key as keyof Feedback] as number | null;
    d.ensure(16);
    d.page.drawText(c.en, { x: M, y: d.y - 10, size: 10, font: d.sans, color: C.ink });
    if (v) {
      d.crowns(M + 150, d.y - 10, v);
      d.page.drawText(`${v}/5`, { x: M + 220, y: d.y - 10, size: 10, font: d.sansBold, color: C.ink });
    } else d.page.drawText("Not rated", { x: M + 150, y: d.y - 10, size: 9, font: d.sans, color: C.muted });
    d.y -= 16;
  }
  d.kv("Recommendation (0-10)", f.nps != null ? String(f.nps) : "Not answered");
  d.heading("Details");
  d.kv("Visit date", fmtVisitDate(f.visitDate));
  d.kv("Seating", `${sectionLabel(f.section)}${f.table ? `, Table ${f.table}` : ""}`);
  d.kv("Occasion", occasionLabel(f.occasion));
  d.kv("What stood out", f.highlights.map(highlightLabel).join(", ") || "—");
  d.kv("What could be better", f.improvements.map(improvementLabel).join(", ") || "—");
  d.kv("Staff recognised", f.staffName ? `${f.staffName}${f.staffMessage ? ` — "${f.staffMessage}"` : ""}` : "—");
  d.kv("Language", f.language === "sw" ? "Kiswahili" : "English");
  d.kv("Sentiment", f.sentiment.toLowerCase());
  d.heading("Guest contact");
  d.kv("Name", guestLabel(f));
  d.kv("Email", f.guestEmail || "—");
  d.kv("Phone", f.guestPhone || "—");
  d.kv("Follow-up requested", f.followUp ? "Yes" : "No", f.followUp ? C.crimson : undefined);
  d.heading("Handling");
  d.kv("Status", f.status.replace("_", " ").toLowerCase());
  d.kv("Assigned to", f.assignee?.name || "Unassigned");
  if (f.resolvedAt) d.kv("Resolved", fmtDateTime(f.resolvedAt));
  if (f.notes.length) {
    d.heading("Internal notes");
    for (const n of f.notes) d.text(`${n.author?.name ?? "Former user"} · ${fmtDateTime(n.createdAt)}\n${n.body}`, { size: 9.5, gap: 6 });
  }
  if (f.replies.length) {
    d.heading("Replies to guest");
    for (const r of f.replies) d.text(`${r.channel} to ${r.to} by ${r.author?.name ?? "—"} · ${fmtDateTime(r.createdAt)} · ${r.status.toLowerCase()}\n${r.body}`, { size: 9, gap: 8 });
  }
  if (f.photos.length) {
    d.heading("Photos");
    let x = M;
    const h = 150;
    d.ensure(h + 10);
    for (const p of f.photos) {
      try {
        const bytes = Buffer.from(p.data);
        const img = p.mime === "image/png" ? await d.doc.embedPng(bytes) : p.mime === "image/jpeg" ? await d.doc.embedJpg(bytes) : null;
        if (!img) continue;
        const w = Math.min(160, (h * img.width) / img.height);
        const hh = (w * img.height) / img.width;
        d.page.drawImage(img, { x, y: d.y - hh, width: w, height: hh });
        x += w + 10;
      } catch {
        /* unsupported image (e.g. WebP) — viewable in portal */
      }
    }
    d.y -= h + 10;
  }
}

export async function feedbackPdf(f: FeedbackFull) {
  const d = await new Doc("Guest feedback", `${feedbackRef(f.number)} · exported ${fmtDate(new Date())}`).init();
  await writeFeedback(d, f);
  return d.save();
}

export async function feedbackListPdf(rows: Feedback[], description: string) {
  const d = await new Doc("Feedback register", `${rows.length} item${rows.length === 1 ? "" : "s"} · ${fmtDate(new Date())}`).init();
  d.text(description, { color: C.muted, size: 9 });
  const cols = [
    { k: "Ref", w: 46 }, { k: "Received", w: 78 }, { k: "Rating", w: 36 }, { k: "Seating", w: 92 },
    { k: "Guest", w: 82 }, { k: "Status", w: 60 }, { k: "Comment", w: A4.w - 2 * M - 394 },
  ];
  const header = () => {
    d.ensure(20);
    let x = M;
    d.page.drawRectangle({ x: M, y: d.y - 15, width: A4.w - 2 * M, height: 16, color: C.green });
    for (const c of cols) {
      d.page.drawText(c.k, { x: x + 3, y: d.y - 11, size: 8, font: d.sansBold, color: C.white });
      x += c.w;
    }
    d.y -= 18;
  };
  header();
  rows.forEach((f, i) => {
    const comment = (f.suggestion || f.staffMessage || "").replace(/\s+/g, " ");
    const cells = [
      feedbackRef(f.number), fmtDateTime(f.createdAt), `${f.overall}/5`, `${sectionLabel(f.section)}${f.table ? ` T${f.table}` : ""}`,
      guestLabel(f), f.status.replace("_", " ").toLowerCase(), comment.length > 160 ? `${comment.slice(0, 160)}…` : comment,
    ];
    const wrapped = cells.map((c, j) => d.wrap(c, d.sans, 7.5, cols[j].w - 6));
    const h = Math.max(...wrapped.map((w) => w.length)) * 9.5 + 5;
    if (d.y - h < 52) {
      d.newPage();
      header();
    }
    if (i % 2) d.page.drawRectangle({ x: M, y: d.y - h + 2, width: A4.w - 2 * M, height: h, color: C.ivory });
    let x = M;
    wrapped.forEach((lines, j) => {
      lines.forEach((l, li) =>
        d.page.drawText(l, { x: x + 3, y: d.y - 8 - li * 9.5, size: 7.5, font: j === 2 && f.urgent ? d.sansBold : d.sans, color: j === 2 && f.urgent ? C.crimson : C.ink }),
      );
      x += cols[j].w;
    });
    d.y -= h;
  });
  return d.save();
}

type Insights = Awaited<ReturnType<typeof getInsights>>;
type QrStats = Awaited<ReturnType<typeof getQrStats>>;

export async function monthlyReportPdf(title: string, periodText: string, ins: Insights, qr: QrStats, urgentItems: Feedback[]) {
  const d = await new Doc(title, periodText).init();
  const t = ins.totals;
  d.page.drawText(safe(title), { x: M, y: d.y - 24, size: 24, font: d.serifBold, color: C.ink });
  d.y -= 32;
  d.text(periodText, { color: C.muted });

  // KPI tiles
  const tiles = [
    ["Responses", String(t.count)],
    ["Average rating", t.avgOverall ? `${t.avgOverall.toFixed(2)} / 5` : "—"],
    ["Recommendation (NPS)", t.nps == null ? "—" : String(t.nps)],
    ["Urgent (1-3)", String(t.urgent)],
  ];
  const tw = (A4.w - 2 * M - 30) / 4;
  d.ensure(64);
  tiles.forEach(([k, v], i) => {
    const x = M + i * (tw + 10);
    d.page.drawRectangle({ x, y: d.y - 56, width: tw, height: 56, color: C.ivory, borderColor: C.line, borderWidth: 0.6 });
    d.page.drawText(safe(v), { x: x + 10, y: d.y - 28, size: 18, font: d.serifBold, color: i === 3 && t.urgent ? C.crimson : C.green });
    d.page.drawText(safe(k.toUpperCase()), { x: x + 10, y: d.y - 46, size: 7, font: d.sans, color: C.muted });
  });
  d.y -= 68;
  const delta = (cur: number | null, prev: number | null, digits = 2) =>
    cur == null || prev == null ? "no comparison" : `${cur - prev >= 0 ? "+" : ""}${(cur - prev).toFixed(digits)} vs previous period`;
  d.text(`Average rating ${delta(t.avgOverall, t.prevAvg)} · NPS ${delta(t.nps, t.prevNps, 0)} · ${t.open} still open · average time to resolve ${t.avgResolutionHours ? `${t.avgResolutionHours.toFixed(1)} h` : "—"}`, { size: 9, color: C.muted });

  d.heading("Rating distribution");
  const maxD = Math.max(1, ...t.distribution);
  [5, 4, 3, 2, 1].forEach((n) => d.bar(`${n} — ${RATING_LABELS.en[n]}`, t.distribution[n - 1], maxD, { color: n <= 3 ? C.crimson : C.green }));

  d.heading("By category (average out of 5)");
  for (const c of ins.byCategory) d.bar(c.label, c.avg, 5, { color: C.gold });

  d.heading("By seating area");
  for (const s of ins.bySection) d.bar(`${s.label} (${s.count})`, s.avg, 5);

  d.heading("By occasion");
  for (const o of ins.byOccasion.filter((o) => o.count)) d.bar(`${o.label} (${o.count})`, o.avg, 5, { color: C.gold });

  d.heading("Trend");
  const maxT = Math.max(1, ...ins.trend.map((x) => x.count));
  for (const x of ins.trend) d.bar(`${x.label}${x.avg ? ` · avg ${x.avg.toFixed(1)}` : ""}`, x.count, maxT, { labelWidth: 130 });

  if (ins.staff.length) {
    d.heading("Staff recognition");
    const maxS = ins.staff[0].count;
    for (const s of ins.staff.slice(0, 10)) d.bar(s.name, s.count, maxS, { suffix: " mentions", color: C.gold, labelWidth: 110 });
  }

  if (ins.themes.length) {
    d.heading("Top themes in written comments");
    for (const th of ins.themes.slice(0, 8)) d.kv(th.label, `${th.total} mentions · ${th.positive} positive · ${th.neutral} neutral · ${th.negative} negative`);
  }
  if (ins.improvements.length) {
    d.heading("Most-cited improvements");
    d.text(ins.improvements.slice(0, 8).map((i) => `${i.label} (${i.count})`).join(" · "), { size: 9.5 });
  }

  d.heading("QR codes");
  d.kv("Scans vs submissions", `${qr.totalScans} scans · ${qr.totalSubs} submissions · ${qr.rate == null ? "—" : `${Math.round(qr.rate * 100)}% completion`}`);
  for (const s of qr.bySection) d.kv(s.label, `${s.scans} scans · ${s.submissions} submissions · ${s.rate == null ? "—" : `${Math.round(s.rate * 100)}%`}`);

  if (urgentItems.length) {
    d.heading("Urgent feedback this period");
    for (const f of urgentItems.slice(0, 30)) {
      d.text(`${feedbackRef(f.number)} · ${f.overall}/5 · ${sectionLabel(f.section)}${f.table ? ` T${f.table}` : ""} · ${fmtDateTime(f.createdAt)} · ${f.status.replace("_", " ").toLowerCase()}`, { font: d.sansBold, size: 9, color: C.crimson, gap: 1 });
      if (f.suggestion) d.text(f.suggestion.slice(0, 400), { size: 9, gap: 6 });
    }
  }
  return d.save();
}
