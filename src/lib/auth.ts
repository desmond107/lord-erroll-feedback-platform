import "server-only";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Role, User } from "@prisma/client";
import { prisma } from "./db";
import { clientIp, clientUserAgent } from "./request";

const COOKIE = "le_session";
const SESSION_TTL_MS = 7 * 24 * 3600 * 1000;
const PENDING_TTL_MS = 10 * 60 * 1000;

export type Permission = "view" | "manage" | "reply" | "export" | "tables" | "users" | "activity";

const MATRIX: Record<Role, Permission[]> = {
  OWNER: ["view", "manage", "reply", "export", "tables", "users", "activity"],
  MANAGER: ["view", "manage", "reply", "export", "tables"],
  SUPERVISOR: ["view"],
};

export const ROLE_LABELS: Record<Role, string> = {
  OWNER: "Owner",
  MANAGER: "Manager",
  SUPERVISOR: "Supervisor",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  OWNER: "Full access, including team and activity log",
  MANAGER: "View, reply to guests, manage status, notes and exports",
  SUPERVISOR: "View feedback and insights only",
};

export function can(user: Pick<User, "role"> | null | undefined, p: Permission) {
  return !!user && MATRIX[user.role].includes(p);
}

export type SessionUser = Pick<User, "id" | "email" | "name" | "role" | "totpEnabled">;

const sha = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

export async function hashPassword(pw: string) {
  return bcrypt.hash(pw, 12);
}

export async function verifyPassword(pw: string, hash: string) {
  return bcrypt.compare(pw, hash);
}

export function passwordProblem(pw: string): string | null {
  if (pw.length < 10) return "Use at least 10 characters.";
  if (!/[a-zA-Z]/.test(pw) || !/[0-9]/.test(pw)) return "Use a mix of letters and numbers.";
  return null;
}

export async function createSession(userId: string, pending2fa: boolean) {
  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + (pending2fa ? PENDING_TTL_MS : SESSION_TTL_MS));
  await prisma.session.create({
    data: { tokenHash: sha(token), userId, pending2fa, expiresAt, ip: await clientIp(), userAgent: await clientUserAgent() },
  });
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

async function readSession() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { tokenHash: sha(token) },
    include: { user: { select: { id: true, email: true, name: true, role: true, totpEnabled: true, active: true } } },
  });
  if (!session || session.expiresAt < new Date() || !session.user.active) return null;
  return session;
}

/** The fully signed-in user, or null. */
export async function getUser(): Promise<SessionUser | null> {
  const s = await readSession();
  if (!s || s.pending2fa) return null;
  const { active: _active, ...user } = s.user;
  return user;
}

/** A session that passed the password step and is waiting on a TOTP code. */
export async function getPending2fa() {
  const s = await readSession();
  return s?.pending2fa ? s : null;
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await prisma.session.deleteMany({ where: { tokenHash: sha(token) } });
  jar.delete(COOKIE);
}

/** Signs a user out everywhere except this browser, e.g. after a password change. */
export async function destroyOtherSessions(userId: string) {
  const token = (await cookies()).get(COOKIE)?.value;
  await prisma.session.deleteMany({ where: { userId, ...(token ? { tokenHash: { not: sha(token) } } : {}) } });
}

export async function requireUser(p: Permission = "view"): Promise<SessionUser> {
  const user = await getUser();
  if (!user) redirect("/portal/login");
  if (!can(user, p)) redirect("/portal?denied=1");
  return user;
}

/** For server actions and route handlers: throws instead of redirecting. */
export async function assertUser(p: Permission = "view"): Promise<SessionUser> {
  const user = await getUser();
  if (!user) throw new AuthError("Please sign in again.", 401);
  if (!can(user, p)) throw new AuthError("Your role doesn't allow that.", 403);
  return user;
}

export class AuthError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}
