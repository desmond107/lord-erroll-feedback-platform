import { prisma } from "@/lib/db";
import { AuthError, assertUser } from "@/lib/auth";
import { buildWhere, INBOX_ORDER, readFilters } from "@/lib/feedback-query";
import { toCsv, toXlsx } from "@/lib/export";
import { feedbackListPdf } from "@/lib/pdf";
import { logActivity } from "@/lib/activity";
import { nairobiDateKey } from "@/lib/format";
import { sectionLabel } from "@/lib/config";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: Request) {
  let user;
  try {
    user = await assertUser("export");
  } catch (e) {
    return new Response((e as Error).message, { status: e instanceof AuthError ? e.status : 401 });
  }
  const url = new URL(req.url);
  const format = url.searchParams.get("format") || "csv";
  const f = readFilters(url.searchParams);
  const rows = await prisma.feedback.findMany({
    where: buildWhere(f, user.id),
    orderBy: INBOX_ORDER,
    take: 20000,
    include: { assignee: { select: { name: true } }, _count: { select: { photos: true, notes: true } } },
  });
  const stamp = nairobiDateKey();
  const desc = Object.entries(f).filter(([k]) => k !== "page").map(([k, v]) => `${k}: ${k === "section" ? sectionLabel(v) : v}`).join(" · ") || "All feedback";
  await logActivity(user.id, "feedback.export", `${rows.length} items`, `${format} · ${desc}`);

  if (format === "xlsx") {
    return new Response(new Uint8Array(await toXlsx(rows)), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="lord-erroll-feedback-${stamp}.xlsx"`,
      },
    });
  }
  if (format === "pdf") {
    return new Response(new Uint8Array(await feedbackListPdf(rows, `Filters — ${desc}`)), {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="lord-erroll-feedback-${stamp}.pdf"` },
    });
  }
  return new Response(toCsv(rows), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="lord-erroll-feedback-${stamp}.csv"` },
  });
}
