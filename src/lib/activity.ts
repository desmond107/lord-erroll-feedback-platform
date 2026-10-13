import "server-only";
import { prisma } from "./db";
import { clientIp } from "./request";

export async function logActivity(userId: string | null, action: string, target?: string | null, detail?: string | null) {
  try {
    await prisma.activityLog.create({
      data: { userId, action, target: target ?? null, detail: detail?.slice(0, 500) ?? null, ip: await clientIp().catch(() => null) },
    });
  } catch (e) {
    console.error("[activity] failed to log", action, e);
  }
}

export const ACTIVITY_LABELS: Record<string, string> = {
  "auth.login": "Signed in",
  "auth.login_failed": "Failed sign-in attempt",
  "auth.logout": "Signed out",
  "auth.2fa_enabled": "Enabled two-factor authentication",
  "auth.2fa_disabled": "Disabled two-factor authentication",
  "auth.password_changed": "Changed password",
  "feedback.viewed": "Opened feedback",
  "feedback.status": "Changed status",
  "feedback.assigned": "Assigned feedback",
  "feedback.starred": "Starred / unstarred",
  "feedback.pinned": "Pinned / unpinned",
  "feedback.note": "Added an internal note",
  "feedback.reply": "Replied to guest",
  "feedback.export": "Exported feedback",
  "user.created": "Added a team member",
  "user.updated": "Updated a team member",
  "user.removed": "Removed a team member",
  "tables.updated": "Updated tables",
  "settings.updated": "Updated notification preferences",
};
