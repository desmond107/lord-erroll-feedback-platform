"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { FeedbackStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { assertUser } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { feedbackRef } from "@/lib/config";
import { guestReplyEmail } from "@/lib/emails";
import { sendEmail } from "@/lib/notify";

type Result = { ok: true; message?: string; waUrl?: string } | { ok: false; error: string };

async function guard<T>(fn: () => Promise<T>): Promise<T | { ok: false; error: string }> {
  try {
    return await fn();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

async function ref(id: string) {
  const f = await prisma.feedback.findUniqueOrThrow({ where: { id }, select: { number: true } });
  return feedbackRef(f.number);
}

export async function setStatus(id: string, status: FeedbackStatus): Promise<Result> {
  return guard(async () => {
    const user = await assertUser("manage");
    if (!["NEW", "IN_PROGRESS", "RESOLVED"].includes(status)) throw new Error("Unknown status");
    await prisma.feedback.update({ where: { id }, data: { status, resolvedAt: status === "RESOLVED" ? new Date() : null } });
    await logActivity(user.id, "feedback.status", await ref(id), status);
    revalidatePath(`/portal/feedback/${id}`);
    return { ok: true as const };
  });
}

export async function assign(id: string, assigneeId: string | null): Promise<Result> {
  return guard(async () => {
    const user = await assertUser("manage");
    if (assigneeId) await prisma.user.findFirstOrThrow({ where: { id: assigneeId, active: true, role: { in: ["OWNER", "MANAGER"] } } });
    const f = await prisma.feedback.update({ where: { id }, data: { assigneeId }, include: { assignee: { select: { name: true } } } });
    await logActivity(user.id, "feedback.assigned", await ref(id), f.assignee?.name ?? "Unassigned");
    revalidatePath(`/portal/feedback/${id}`);
    return { ok: true as const };
  });
}

export async function toggleFlag(id: string, flag: "starred" | "pinned"): Promise<Result> {
  return guard(async () => {
    const user = await assertUser("manage");
    if (flag !== "starred" && flag !== "pinned") throw new Error("Unknown flag");
    const f = await prisma.feedback.findUniqueOrThrow({ where: { id }, select: { starred: true, pinned: true } });
    await prisma.feedback.update({ where: { id }, data: { [flag]: !f[flag] } });
    await logActivity(user.id, flag === "starred" ? "feedback.starred" : "feedback.pinned", await ref(id), String(!f[flag]));
    revalidatePath(`/portal/feedback/${id}`);
    return { ok: true as const };
  });
}

export async function markUnread(id: string): Promise<Result> {
  return guard(async () => {
    const user = await assertUser("view");
    await prisma.feedbackRead.deleteMany({ where: { feedbackId: id, userId: user.id } });
    revalidatePath("/portal");
    return { ok: true as const };
  });
}

export async function addNote(id: string, body: string): Promise<Result> {
  return guard(async () => {
    const user = await assertUser("manage");
    const text = body.trim().slice(0, 4000);
    if (!text) throw new Error("Write a note first.");
    await prisma.note.create({ data: { feedbackId: id, authorId: user.id, body: text } });
    await logActivity(user.id, "feedback.note", await ref(id));
    revalidatePath(`/portal/feedback/${id}`);
    return { ok: true as const };
  });
}

const replySchema = z.object({
  channel: z.enum(["EMAIL", "WHATSAPP"]),
  templateKey: z.string().max(40).nullable(),
  subject: z.string().trim().max(200),
  body: z.string().trim().min(10).max(6000),
});

/** Kenyan numbers written 07… / 01… become 2547… / 2541… for wa.me links. */
function waNumber(phone: string) {
  let d = phone.replace(/\D/g, "");
  if (d.startsWith("0") && d.length === 10) d = `254${d.slice(1)}`;
  if (d.length === 9 && /^[71]/.test(d)) d = `254${d}`;
  return d;
}

export async function sendReply(id: string, input: z.infer<typeof replySchema>): Promise<Result> {
  return guard(async () => {
    const user = await assertUser("reply");
    const r = replySchema.parse(input);
    const f = await prisma.feedback.findUniqueOrThrow({ where: { id } });
    const reference = feedbackRef(f.number);
    if (r.channel === "EMAIL") {
      if (!f.guestEmail) throw new Error("This guest didn't leave an email address.");
      const mail = guestReplyEmail(r.subject || "Thank you from The Lord Erroll", r.body);
      const sent = await sendEmail({ to: f.guestEmail, ...mail, kind: "guest-reply", feedbackId: f.id });
      await prisma.reply.create({
        data: { feedbackId: id, authorId: user.id, channel: "EMAIL", templateKey: r.templateKey, to: f.guestEmail, subject: mail.subject, body: r.body, status: sent.status, error: sent.error },
      });
      if (sent.status === "FAILED") throw new Error(`Email failed: ${sent.error}`);
      if (f.status === "NEW") await prisma.feedback.update({ where: { id }, data: { status: "IN_PROGRESS" } });
      await logActivity(user.id, "feedback.reply", reference, `email ${sent.status.toLowerCase()}`);
      revalidatePath(`/portal/feedback/${id}`);
      return {
        ok: true as const,
        message: sent.status === "SENT" ? `Email sent to ${f.guestEmail}.` : "Saved, but email isn't configured yet (add RESEND_API_KEY). Nothing was sent.",
      };
    }
    if (!f.guestPhone) throw new Error("This guest didn't leave a phone number.");
    const num = waNumber(f.guestPhone);
    // WhatsApp replies open in the manager's own WhatsApp; we record what was prepared.
    await prisma.reply.create({ data: { feedbackId: id, authorId: user.id, channel: "WHATSAPP", templateKey: r.templateKey, to: num, body: r.body, status: "SENT" } });
    if (f.status === "NEW") await prisma.feedback.update({ where: { id }, data: { status: "IN_PROGRESS" } });
    await logActivity(user.id, "feedback.reply", reference, "whatsapp");
    revalidatePath(`/portal/feedback/${id}`);
    return { ok: true as const, waUrl: `https://wa.me/${num}?text=${encodeURIComponent(r.body)}`, message: "WhatsApp opened with your message." };
  });
}
