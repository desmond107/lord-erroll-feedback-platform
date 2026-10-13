import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { URGENT_THRESHOLD } from "./config";
import { classifySentiment } from "./sentiment";
import type { Submission } from "./validation";
import { newFeedbackEmail, shortSummary } from "./emails";
import { ownerEmails, ownerPhone, sendEmail, sendSms, sendWhatsApp } from "./notify";

export const MAX_PHOTOS = 3;
export const MAX_PHOTO_BYTES = 2.5 * 1024 * 1024;

export function sniffImage(buf: Buffer): string | null {
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  return null;
}

export function feedbackDataFrom(s: Submission): Omit<Prisma.FeedbackCreateInput, "clientId"> {
  const r = s.ratings;
  return {
    visitDate: new Date(`${s.visitDate}T00:00:00Z`),
    section: s.section,
    table: s.table,
    occasion: s.occasion ?? null,
    overall: s.overall,
    food: r.food ?? null,
    service: r.service ?? null,
    ambience: r.ambience ?? null,
    cleanliness: r.cleanliness ?? null,
    value: r.value ?? null,
    drinks: r.drinks ?? null,
    speed: r.speed ?? null,
    highlights: s.highlights,
    improvements: s.improvements,
    staffName: s.staffName,
    staffMessage: s.staffMessage,
    suggestion: s.suggestion,
    nps: s.nps ?? null,
    guestName: s.guestName,
    guestEmail: s.guestEmail,
    guestPhone: s.guestPhone,
    followUp: s.followUp && !!(s.guestEmail || s.guestPhone),
    language: s.lang,
    urgent: s.overall <= URGENT_THRESHOLD,
    sentiment: classifySentiment({ overall: s.overall, nps: s.nps, text: [s.suggestion, s.staffMessage].filter(Boolean).join(" ") }),
    durationSec: Math.max(0, Math.min(86400, Math.round((Date.now() - s.startedAt) / 1000))),
  };
}

/** Sends the instant owner alerts for one submission. Every attempt lands in NotificationLog. */
export async function notifyNewFeedback(feedbackId: string) {
  const f = await prisma.feedback.findUnique({ where: { id: feedbackId }, include: { _count: { select: { photos: true } } } });
  if (!f) return;
  const watchers = await prisma.user.findMany({ where: { active: true, notifyInstant: true }, select: { email: true } });
  const to = [...new Set([...ownerEmails(), ...watchers.map((w) => w.email)].map((e) => e.toLowerCase()))];
  const mail = newFeedbackEmail({ ...f, photoCount: f._count.photos });
  const summary = shortSummary(f);
  const phone = ownerPhone();
  const smsForAll = process.env.SMS_ALERTS === "all";
  await Promise.allSettled([
    sendEmail({ to, ...mail, replyTo: f.guestEmail || undefined, kind: f.urgent ? "instant-urgent" : "instant", feedbackId: f.id }),
    sendWhatsApp(phone, summary, f.urgent ? "instant-urgent" : "instant", f.id),
    f.urgent || smsForAll ? sendSms(phone, summary, f.urgent ? "instant-urgent" : "instant", f.id) : Promise.resolve(),
  ]);
}
