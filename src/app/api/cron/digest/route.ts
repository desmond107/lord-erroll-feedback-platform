import { NextResponse } from "next/server";
import { runDigest, type DigestKind } from "@/lib/digest";

export const runtime = "nodejs";
export const maxDuration = 60;

// Called by a scheduler (vercel.json crons, GitHub Actions, or crontab + curl).
// Authorise with "Authorization: Bearer $CRON_SECRET".
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }
  const kind = new URL(req.url).searchParams.get("kind") as DigestKind;
  if (!["daily", "weekly", "monthly"].includes(kind)) return NextResponse.json({ error: "kind must be daily, weekly or monthly" }, { status: 400 });
  return NextResponse.json(await runDigest(kind));
}
