import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { SECTION_SLUGS } from "@/lib/config";
import { TABLE_RE } from "@/lib/validation";
import { clientIp, hashIp } from "@/lib/request";
import { rateLimit } from "@/lib/ratelimit";
import { nairobiDateKey } from "@/lib/format";

const schema = z.object({
  section: z.enum(SECTION_SLUGS as [string, ...string[]]),
  table: z.string().regex(TABLE_RE).nullable().optional(),
  visitorId: z.string().min(8).max(64),
});

// Records a QR scan. Called with sendBeacon when the guest site opens with ?section=…
export async function POST(req: Request) {
  const body = schema.safeParse(await req.json().catch(() => null));
  if (!body.success) return new NextResponse(null, { status: 204 });
  const rl = await rateLimit(`scan:${hashIp(await clientIp())}`, 300, 3600);
  if (!rl.ok) return new NextResponse(null, { status: 204 });
  const { section, table, visitorId } = body.data;
  await prisma.scanEvent.createMany({
    data: [{ section, table: table || "", visitorId, day: new Date(`${nairobiDateKey()}T00:00:00Z`) }],
    skipDuplicates: true,
  });
  return new NextResponse(null, { status: 204 });
}
