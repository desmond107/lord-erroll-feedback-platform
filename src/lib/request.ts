import "server-only";
import { headers } from "next/headers";
import crypto from "crypto";

export async function clientIp() {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip") || "unknown").slice(0, 64);
}

export async function clientUserAgent() {
  return ((await headers()).get("user-agent") || "").slice(0, 300);
}

/** The server secret. A missing one in production would make 2FA keys and IP hashes guessable. */
export function authSecret() {
  const s = process.env.AUTH_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === "production" && process.env.VERCEL) throw new Error("AUTH_SECRET is not set.");
  return "dev";
}

// IPs are never stored raw; a salted hash is enough for rate limiting and duplicate checks.
export function hashIp(ip: string) {
  return crypto.createHmac("sha256", authSecret()).update(ip).digest("hex").slice(0, 32);
}
