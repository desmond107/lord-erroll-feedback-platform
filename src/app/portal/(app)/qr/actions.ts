"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { assertUser } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { SECTION_SLUGS, sectionLabel } from "@/lib/config";
import { TABLE_RE } from "@/lib/validation";

export async function addTables(section: string, input: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const user = await assertUser("tables");
    if (!(SECTION_SLUGS as string[]).includes(section)) throw new Error("Unknown section");
    // Accepts "12", "12, 14, 15" or ranges like "41-45".
    const nums = new Set<string>();
    for (const part of input.split(/[\s,]+/).filter(Boolean)) {
      const r = part.match(/^(\d{1,4})-(\d{1,4})$/);
      if (r) {
        const [a, b] = [Number(r[1]), Number(r[2])].sort((x, y) => x - y);
        if (b - a > 100) throw new Error("That range is too large.");
        for (let n = a; n <= b; n++) nums.add(String(n));
      } else if (TABLE_RE.test(part)) nums.add(part);
      else throw new Error(`"${part}" isn't a valid table number.`);
    }
    if (!nums.size) throw new Error("Enter at least one table number.");
    for (const number of nums) {
      await prisma.diningTable.upsert({ where: { section_number: { section, number } }, update: { active: true }, create: { section, number } });
    }
    await logActivity(user.id, "tables.updated", sectionLabel(section), `added ${[...nums].join(", ")}`);
    revalidatePath("/portal/qr");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function removeTable(section: string, number: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const user = await assertUser("tables");
    await prisma.diningTable.update({ where: { section_number: { section, number } }, data: { active: false } });
    await logActivity(user.id, "tables.updated", sectionLabel(section), `removed ${number}`);
    revalidatePath("/portal/qr");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
