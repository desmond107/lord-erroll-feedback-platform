"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { assertUser, hashPassword, passwordProblem, verifyPassword } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { newSecret, openSecret, sealSecret, totpQrDataUrl, verifyTotp } from "@/lib/totp";
import { runDigest, type DigestKind } from "@/lib/digest";
import { notifyNewFeedback } from "@/lib/submit";

type R = { ok: boolean; error?: string; message?: string; qr?: string; secret?: string };
const fail = (e: unknown): R => ({ ok: false, error: (e as Error).message });

export async function saveProfile(name: string): Promise<R> {
  try {
    const u = await assertUser();
    if (name.trim().length < 2) return { ok: false, error: "Please enter your name." };
    await prisma.user.update({ where: { id: u.id }, data: { name: name.trim().slice(0, 80) } });
    revalidatePath("/portal", "layout");
    return { ok: true, message: "Saved." };
  } catch (e) {
    return fail(e);
  }
}

export async function changePassword(current: string, next: string): Promise<R> {
  try {
    const u = await assertUser();
    const row = await prisma.user.findUniqueOrThrow({ where: { id: u.id } });
    if (!(await verifyPassword(current, row.passwordHash))) return { ok: false, error: "Your current password isn't right." };
    const problem = passwordProblem(next);
    if (problem) return { ok: false, error: problem };
    await prisma.user.update({ where: { id: u.id }, data: { passwordHash: await hashPassword(next) } });
    await logActivity(u.id, "auth.password_changed");
    return { ok: true, message: "Password changed." };
  } catch (e) {
    return fail(e);
  }
}

export async function startTotp(): Promise<R> {
  try {
    const u = await assertUser();
    const secret = newSecret();
    // Stored sealed but not enabled until a code is confirmed.
    await prisma.user.update({ where: { id: u.id }, data: { totpSecret: sealSecret(secret), totpEnabled: false } });
    return { ok: true, qr: await totpQrDataUrl(u.email, secret), secret };
  } catch (e) {
    return fail(e);
  }
}

export async function confirmTotp(code: string): Promise<R> {
  try {
    const u = await assertUser();
    const row = await prisma.user.findUniqueOrThrow({ where: { id: u.id } });
    if (!row.totpSecret || !verifyTotp(code, openSecret(row.totpSecret))) return { ok: false, error: "That code didn't match. Try the newest one." };
    await prisma.user.update({ where: { id: u.id }, data: { totpEnabled: true } });
    await logActivity(u.id, "auth.2fa_enabled");
    revalidatePath("/portal/settings");
    return { ok: true, message: "Two-factor authentication is on." };
  } catch (e) {
    return fail(e);
  }
}

export async function disableTotp(password: string): Promise<R> {
  try {
    const u = await assertUser();
    const row = await prisma.user.findUniqueOrThrow({ where: { id: u.id } });
    if (!(await verifyPassword(password, row.passwordHash))) return { ok: false, error: "Password isn't right." };
    await prisma.user.update({ where: { id: u.id }, data: { totpEnabled: false, totpSecret: null } });
    await logActivity(u.id, "auth.2fa_disabled");
    revalidatePath("/portal/settings");
    return { ok: true, message: "Two-factor authentication is off." };
  } catch (e) {
    return fail(e);
  }
}

export async function savePrefs(p: { notifyInstant: boolean; digestDaily: boolean; digestWeekly: boolean; digestMonthly: boolean }): Promise<R> {
  try {
    const u = await assertUser();
    await prisma.user.update({ where: { id: u.id }, data: p });
    await logActivity(u.id, "settings.updated", null, JSON.stringify(p));
    return { ok: true, message: "Preferences saved." };
  } catch (e) {
    return fail(e);
  }
}

export async function sendTestDigest(kind: DigestKind): Promise<R> {
  try {
    const u = await assertUser();
    const r = await runDigest(kind, { onlyTo: u.email });
    return r.status === "SENT"
      ? { ok: true, message: `Sent a ${kind} digest to ${u.email}.` }
      : { ok: true, message: `Digest built (${r.items} items) but not sent: email isn't configured yet. See the delivery log below.` };
  } catch (e) {
    return fail(e);
  }
}

export async function retryAlerts(feedbackId: string): Promise<R> {
  try {
    await assertUser("manage");
    await notifyNewFeedback(feedbackId);
    revalidatePath("/portal/settings");
    return { ok: true, message: "Alerts re-sent." };
  } catch (e) {
    return fail(e);
  }
}
