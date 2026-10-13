import "server-only";
import { prisma } from "./db";
import { DEFAULT_TABLES, SECTIONS } from "./config";

/** Active tables grouped by section; seeds the default plan on first use. */
export async function getTables() {
  let rows = await prisma.diningTable.findMany({ where: { active: true } });
  if (!rows.length && !(await prisma.diningTable.count())) {
    await prisma.diningTable.createMany({
      data: Object.entries(DEFAULT_TABLES).flatMap(([section, nums]) => nums.map((number) => ({ section, number }))),
      skipDuplicates: true,
    });
    rows = await prisma.diningTable.findMany({ where: { active: true } });
  }
  const byNum = (a: string, b: string) => a.localeCompare(b, "en", { numeric: true });
  return SECTIONS.map((s) => ({ ...s, tables: rows.filter((r) => r.section === s.slug).map((r) => r.number).sort(byNum) }));
}
