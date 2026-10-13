import { AuthError, assertUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getInsights, getQrStats, resolveRange } from "@/lib/stats";
import { monthlyReportPdf } from "@/lib/pdf";
import { fmtDate, nairobiDateKey } from "@/lib/format";
import { logActivity } from "@/lib/activity";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: Request) {
  let user;
  try {
    user = await assertUser("export");
  } catch (e) {
    return new Response((e as Error).message, { status: e instanceof AuthError ? e.status : 401 });
  }
  const range = resolveRange(new URL(req.url).searchParams.get("range") ?? undefined);
  const [ins, qr, urgent] = await Promise.all([
    getInsights(range),
    getQrStats(range),
    prisma.feedback.findMany({ where: { urgent: true, createdAt: { gte: range.from, lte: range.to } }, orderBy: { createdAt: "desc" } }),
  ]);
  const pdf = await monthlyReportPdf("Feedback report", `${range.label} · ${fmtDate(range.from)} – ${fmtDate(range.to)}`, ins, qr, urgent);
  await logActivity(user.id, "feedback.export", "Insights report", range.label);
  return new Response(new Uint8Array(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="lord-erroll-report-${nairobiDateKey()}.pdf"` },
  });
}
