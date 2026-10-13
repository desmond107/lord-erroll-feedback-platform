import { prisma } from "@/lib/db";
import { AuthError, assertUser } from "@/lib/auth";
import { feedbackPdf } from "@/lib/pdf";
import { logActivity } from "@/lib/activity";
import { feedbackRef } from "@/lib/config";

export const runtime = "nodejs";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  let user;
  try {
    user = await assertUser("export");
  } catch (e) {
    return new Response((e as Error).message, { status: e instanceof AuthError ? e.status : 401 });
  }
  const { id } = await params;
  const f = await prisma.feedback.findUnique({
    where: { id },
    include: {
      photos: { select: { id: true, mime: true, data: true } },
      notes: { include: { author: { select: { name: true } } }, orderBy: { createdAt: "asc" } },
      replies: { include: { author: { select: { name: true } } }, orderBy: { createdAt: "asc" } },
      assignee: { select: { name: true } },
    },
  });
  if (!f) return new Response("Not found", { status: 404 });
  const ref = feedbackRef(f.number);
  await logActivity(user.id, "feedback.export", ref, "pdf");
  return new Response(new Uint8Array(await feedbackPdf(f)), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${ref}.pdf"` },
  });
}
