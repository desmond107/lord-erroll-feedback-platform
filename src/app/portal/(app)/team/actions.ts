"use server";

import { revalidatePath } from "next/cache";
import crypto from "crypto";
import { z } from "zod";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { assertUser, hashPassword } from "@/lib/auth";
import { logActivity } from "@/lib/activity";

type R = { ok: boolean; error?: string; tempPassword?: string };

const createSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email().max(200),
  role: z.enum(["OWNER", "MANAGER", "SUPERVISOR"]),
});

function tempPassword() {
  // Readable temporary password, e.g. "Erroll-k7fq-29xm"
  return `Erroll-${crypto.randomBytes(2).toString("hex")}-${crypto.randomInt(10, 99)}${crypto.randomBytes(1).toString("hex")}`;
}

export async function createUser(input: z.infer<typeof createSchema>): Promise<R> {
  try {
    const me = await assertUser("users");
    const d = createSchema.parse(input);
    if (await prisma.user.findUnique({ where: { email: d.email } })) return { ok: false, error: "Someone with that email already has access." };
    const pw = tempPassword();
    await prisma.user.create({ data: { ...d, passwordHash: await hashPassword(pw), digestWeekly: d.role !== "SUPERVISOR" } });
    await logActivity(me.id, "user.created", d.email, d.role);
    revalidatePath("/portal/team");
    return { ok: true, tempPassword: pw };
  } catch (e) {
    return { ok: false, error: e instanceof z.ZodError ? "Check the name, email and role." : (e as Error).message };
  }
}

async function ownersLeft(excludingId: string) {
  return prisma.user.count({ where: { role: "OWNER", active: true, id: { not: excludingId } } });
}

export async function updateUser(id: string, data: { role?: Role; active?: boolean }): Promise<R> {
  try {
    const me = await assertUser("users");
    const target = await prisma.user.findUniqueOrThrow({ where: { id } });
    const demoting = target.role === "OWNER" && ((data.role && data.role !== "OWNER") || data.active === false);
    if (demoting && (await ownersLeft(id)) === 0) return { ok: false, error: "There must always be at least one active owner." };
    await prisma.user.update({ where: { id }, data });
    if (data.active === false) await prisma.session.deleteMany({ where: { userId: id } });
    await logActivity(me.id, "user.updated", target.email, JSON.stringify(data));
    revalidatePath("/portal/team");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function resetPassword(id: string): Promise<R> {
  try {
    const me = await assertUser("users");
    const pw = tempPassword();
    const u = await prisma.user.update({ where: { id }, data: { passwordHash: await hashPassword(pw) } });
    await prisma.session.deleteMany({ where: { userId: id } });
    await logActivity(me.id, "user.updated", u.email, "password reset");
    return { ok: true, tempPassword: pw };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function removeUser(id: string): Promise<R> {
  try {
    const me = await assertUser("users");
    if (id === me.id) return { ok: false, error: "You can't remove yourself." };
    const target = await prisma.user.findUniqueOrThrow({ where: { id } });
    if (target.role === "OWNER" && (await ownersLeft(id)) === 0) return { ok: false, error: "There must always be at least one active owner." };
    await prisma.user.delete({ where: { id } });
    await logActivity(me.id, "user.removed", target.email);
    revalidatePath("/portal/team");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

