import "server-only";
import { prisma } from "./db";

// Fixed-window counter in Postgres, so limits hold across serverless instances.
export async function rateLimit(key: string, limit: number, windowSec: number) {
  const now = new Date();
  const resetAt = new Date(now.getTime() + windowSec * 1000);
  const rows = await prisma.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateBucket" ("key", "count", "resetAt") VALUES (${key}, 1, ${resetAt})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateBucket"."resetAt" < ${now} THEN 1 ELSE "RateBucket"."count" + 1 END,
      "resetAt" = CASE WHEN "RateBucket"."resetAt" < ${now} THEN ${resetAt} ELSE "RateBucket"."resetAt" END
    RETURNING "count"`;
  return { ok: rows[0].count <= limit, count: rows[0].count };
}
