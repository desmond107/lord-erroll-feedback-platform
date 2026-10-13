import "server-only";
import type { Channel, DeliveryStatus } from "@prisma/client";
import { prisma } from "./db";

export type SendResult = { status: DeliveryStatus; error?: string };

type Attachment = { filename: string; content: Buffer };

async function record(channel: Channel, kind: string, to: string, subject: string | null, r: SendResult, feedbackId?: string) {
  await prisma.notificationLog
    .create({ data: { channel, kind, to, subject, status: r.status, error: r.error?.slice(0, 500), feedbackId } })
    .catch((e) => console.error("[notify] could not record delivery", e));
}

// ─── Email (Resend) ─────────────────────────────────────────────────────

export async function sendEmail(opts: {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  attachments?: Attachment[];
  kind: string;
  feedbackId?: string;
}): Promise<SendResult> {
  const to = (Array.isArray(opts.to) ? opts.to : [opts.to]).map((s) => s.trim()).filter(Boolean);
  if (!to.length) return { status: "SKIPPED", error: "No recipient" };
  let result: SendResult;
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.info(`[email:not-configured] ${opts.kind} → ${to.join(", ")} · ${opts.subject}`);
    result = { status: "SKIPPED", error: "RESEND_API_KEY not set" };
  } else {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || "The Lord Erroll <feedback@lord-erroll.com>",
          to,
          subject: opts.subject,
          html: opts.html,
          text: opts.text,
          reply_to: opts.replyTo || process.env.EMAIL_REPLY_TO || undefined,
          attachments: opts.attachments?.map((a) => ({ filename: a.filename, content: a.content.toString("base64") })),
        }),
        signal: AbortSignal.timeout(15000),
      });
      result = res.ok ? { status: "SENT" } : { status: "FAILED", error: `${res.status} ${await res.text()}` };
    } catch (e) {
      result = { status: "FAILED", error: String(e) };
    }
  }
  await record("EMAIL", opts.kind, to.join(", "), opts.subject, result, opts.feedbackId);
  return result;
}

// ─── SMS (Africa's Talking) ─────────────────────────────────────────────

export async function sendSms(to: string, message: string, kind: string, feedbackId?: string): Promise<SendResult> {
  const { AT_USERNAME, AT_API_KEY, AT_SENDER_ID } = process.env;
  let result: SendResult;
  if (!to) result = { status: "SKIPPED", error: "OWNER_ALERT_PHONE not set" };
  else if (!AT_USERNAME || !AT_API_KEY) {
    console.info(`[sms:not-configured] → ${to}: ${message}`);
    result = { status: "SKIPPED", error: "Africa's Talking credentials not set" };
  } else {
    try {
      const host = AT_USERNAME === "sandbox" ? "api.sandbox.africastalking.com" : "api.africastalking.com";
      const body = new URLSearchParams({ username: AT_USERNAME, to: `+${to.replace(/\D/g, "")}`, message });
      if (AT_SENDER_ID) body.set("from", AT_SENDER_ID);
      const res = await fetch(`https://${host}/version1/messaging`, {
        method: "POST",
        headers: { apiKey: AT_API_KEY, Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
        body,
        signal: AbortSignal.timeout(15000),
      });
      result = res.ok ? { status: "SENT" } : { status: "FAILED", error: `${res.status} ${await res.text()}` };
    } catch (e) {
      result = { status: "FAILED", error: String(e) };
    }
  }
  await record("SMS", kind, to || "—", null, result, feedbackId);
  return result;
}

// ─── WhatsApp (Meta Cloud API) ──────────────────────────────────────────
// Business-initiated messages must use an approved template. The template is expected
// to have a single body variable {{1}} that receives the short summary.

export async function sendWhatsApp(to: string, summary: string, kind: string, feedbackId?: string): Promise<SendResult> {
  const { WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_TEMPLATE } = process.env;
  let result: SendResult;
  if (!to) result = { status: "SKIPPED", error: "OWNER_ALERT_PHONE not set" };
  else if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
    console.info(`[whatsapp:not-configured] → ${to}: ${summary}`);
    result = { status: "SKIPPED", error: "WhatsApp Cloud API credentials not set" };
  } else {
    try {
      const res = await fetch(`https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: to.replace(/\D/g, ""),
          type: "template",
          template: {
            name: WHATSAPP_TEMPLATE || "new_feedback_alert",
            language: { code: "en" },
            components: [{ type: "body", parameters: [{ type: "text", text: summary.slice(0, 1000) }] }],
          },
        }),
        signal: AbortSignal.timeout(15000),
      });
      result = res.ok ? { status: "SENT" } : { status: "FAILED", error: `${res.status} ${await res.text()}` };
    } catch (e) {
      result = { status: "FAILED", error: String(e) };
    }
  }
  await record("WHATSAPP", kind, to || "—", null, result, feedbackId);
  return result;
}

export function ownerEmails() {
  return (process.env.OWNER_NOTIFY_EMAILS || "").split(",").map((s) => s.trim()).filter(Boolean);
}

export function ownerPhone() {
  return (process.env.OWNER_ALERT_PHONE || "").replace(/\D/g, "");
}
