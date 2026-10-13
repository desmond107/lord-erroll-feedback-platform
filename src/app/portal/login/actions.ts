"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { createSession, destroySession, getPending2fa, verifyPassword } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { rateLimit } from "@/lib/ratelimit";
import { clientIp, hashIp } from "@/lib/request";
import { openSecret, verifyTotp } from "@/lib/totp";

export type LoginState = { error?: string; step?: "password" | "totp" } | undefined;

function safeNext(next: FormDataEntryValue | null) {
  const n = typeof next === "string" ? next : "";
  return n.startsWith("/portal") && !n.startsWith("//") ? n : "/portal";
}

export async function loginAction(_: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get("email") || "").trim().toLowerCase();
  const password = String(form.get("password") || "");
  const ipKey = hashIp(await clientIp());
  const limit = await rateLimit(`login:${ipKey}`, 10, 900);
  const perUser = await rateLimit(`login-user:${email}`, 8, 900);
  if (!limit.ok || !perUser.ok) return { error: "Too many attempts. Please wait 15 minutes and try again.", step: "password" };

  const user = await prisma.user.findUnique({ where: { email } });
  // Constant-ish time: always run bcrypt.
  const ok = await verifyPassword(password, user?.passwordHash ?? "$2b$12$6hb2SVWMPuU1TkkQdKYeR.VwxGbHchrksqTWf2djNM8p3H4EZKoem");
  if (!user || !ok || !user.active) {
    await logActivity(user?.id ?? null, "auth.login_failed", email);
    return { error: "That email and password don't match our records.", step: "password" };
  }
  await createSession(user.id, user.totpEnabled);
  if (user.totpEnabled) return { step: "totp" };
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await logActivity(user.id, "auth.login");
  redirect(safeNext(form.get("next")));
}

export async function totpAction(_: LoginState, form: FormData): Promise<LoginState> {
  const pending = await getPending2fa();
  if (!pending) return { error: "Your sign-in expired. Please start again.", step: "password" };
  const limit = await rateLimit(`totp:${pending.userId}`, 6, 900);
  if (!limit.ok) return { error: "Too many codes tried. Please wait 15 minutes.", step: "totp" };
  const user = await prisma.user.findUnique({ where: { id: pending.userId } });
  const code = String(form.get("code") || "");
  if (!user?.totpSecret || !verifyTotp(code, openSecret(user.totpSecret))) {
    await logActivity(pending.userId, "auth.login_failed", user?.email, "Wrong two-factor code");
    return { error: "That code isn't right. Codes refresh every 30 seconds.", step: "totp" };
  }
  await destroySession();
  await createSession(user.id, false);
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await logActivity(user.id, "auth.login", null, "with two-factor");
  redirect(safeNext(form.get("next")));
}

export async function logoutAction() {
  const { getUser } = await import("@/lib/auth");
  const u = await getUser();
  if (u) await logActivity(u.id, "auth.logout");
  await destroySession();
  redirect("/portal/login");
}
