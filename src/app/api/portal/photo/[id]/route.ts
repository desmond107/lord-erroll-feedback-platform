import { prisma } from "@/lib/db";
import { getUser } from "@/lib/auth";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getUser())) return new Response("Unauthorised", { status: 401 });
  const { id } = await params;
  const p = await prisma.feedbackPhoto.findUnique({ where: { id }, select: { mime: true, data: true } });
  if (!p) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(p.data), {
    headers: { "Content-Type": p.mime, "Cache-Control": "private, max-age=86400", "Content-Disposition": "inline", "X-Content-Type-Options": "nosniff" },
  });
}
