import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUser } from "@/lib/auth";
import { counts } from "@/lib/portal-data";
import { RATING_LABELS, feedbackRef, sectionLabel } from "@/lib/config";

export const dynamic = "force-dynamic";

// Polled by the portal every few seconds; returns counts plus anything newer than ?after=<number>.
export async function GET(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const after = Number(new URL(req.url).searchParams.get("after") || 0);
  const [c, latest, fresh] = await Promise.all([
    counts(user.id),
    prisma.feedback.findFirst({ orderBy: { number: "desc" }, select: { number: true } }),
    after
      ? prisma.feedback.findMany({
          where: { number: { gt: after } },
          orderBy: { number: "asc" },
          take: 10,
          select: { id: true, number: true, overall: true, section: true, table: true, urgent: true, guestName: true, suggestion: true },
        })
      : Promise.resolve([]),
  ]);
  return NextResponse.json({
    ...c,
    latest: latest?.number ?? 0,
    fresh: fresh.map((f) => ({
      id: f.id,
      ref: feedbackRef(f.number),
      urgent: f.urgent,
      title: `${f.urgent ? "URGENT · " : ""}${f.overall}/5 ${RATING_LABELS.en[f.overall]} · ${sectionLabel(f.section)}${f.table ? ` T${f.table}` : ""}`,
      body: `${f.guestName || "Anonymous"}${f.suggestion ? ` — ${f.suggestion.slice(0, 120)}` : ""}`,
    })),
  });
}
