import { NextResponse, after } from "next/server";
import { prisma } from "@/lib/db";
import { submissionSchema } from "@/lib/validation";
import { feedbackDataFrom, MAX_PHOTO_BYTES, MAX_PHOTOS, notifyNewFeedback, sniffImage } from "@/lib/submit";
import { clientIp, clientUserAgent, hashIp } from "@/lib/request";
import { rateLimit } from "@/lib/ratelimit";
import { feedbackRef } from "@/lib/config";

export const runtime = "nodejs";
export const maxDuration = 30;

const MIN_SECONDS = 8;

export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  let raw: unknown;
  try {
    raw = JSON.parse(String(form.get("payload") ?? ""));
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const parsed = submissionSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid", issues: parsed.error.issues.map((i) => i.path.join(".")) }, { status: 422 });
  }
  const s = parsed.data;

  // Honeypot filled in: pretend success so bots learn nothing.
  if (s.website) return NextResponse.json({ ok: true, ref: null });
  if (Date.now() - s.startedAt < MIN_SECONDS * 1000) return NextResponse.json({ error: "too_fast" }, { status: 422 });

  const visit = new Date(`${s.visitDate}T00:00:00Z`).getTime();
  const now = Date.now();
  if (visit > now + 36 * 3600e3 || visit < now - 90 * 86400e3) {
    return NextResponse.json({ error: "invalid", issues: ["visitDate"] }, { status: 422 });
  }

  // Idempotent retries from a flaky connection return the original submission.
  const existing = await prisma.feedback.findUnique({ where: { clientId: s.clientId }, select: { number: true } });
  if (existing) return NextResponse.json({ ok: true, ref: feedbackRef(existing.number), duplicate: true });

  const ipHash = hashIp(await clientIp());
  // Restaurant Wi-Fi puts many guests behind one IP, so the limit is generous.
  const rl = await rateLimit(`feedback:${ipHash}`, 40, 3600);
  if (!rl.ok) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  // Same device content re-sent within 15 minutes (e.g. double-tap, back-button resubmit).
  const dup = await prisma.feedback.findFirst({
    where: {
      ipHash, section: s.section, table: s.table, overall: s.overall, suggestion: s.suggestion,
      createdAt: { gte: new Date(now - 15 * 60e3) },
    },
    select: { number: true },
  });
  if (dup) return NextResponse.json({ ok: true, ref: feedbackRef(dup.number), duplicate: true });

  const files = form.getAll("photos").filter((f): f is File => typeof f === "object" && "arrayBuffer" in f).slice(0, MAX_PHOTOS);
  const photos: { mime: string; size: number; data: Uint8Array<ArrayBuffer> }[] = [];
  for (const file of files) {
    if (file.size > MAX_PHOTO_BYTES) return NextResponse.json({ error: "photo_too_large" }, { status: 413 });
    const data = new Uint8Array(await file.arrayBuffer());
    const mime = sniffImage(Buffer.from(data.buffer));
    if (!mime) return NextResponse.json({ error: "photo_type" }, { status: 415 });
    photos.push({ mime, size: data.length, data });
  }

  const created = await prisma.feedback.create({
    data: {
      ...feedbackDataFrom(s),
      clientId: s.clientId,
      ipHash,
      userAgent: await clientUserAgent(),
      photos: photos.length ? { create: photos } : undefined,
    },
    select: { id: true, number: true },
  });

  // Alerts go out after the guest has their thank-you screen.
  after(() => notifyNewFeedback(created.id).catch((e) => console.error("[feedback] notify failed", e)));

  return NextResponse.json({ ok: true, ref: feedbackRef(created.number) });
}
