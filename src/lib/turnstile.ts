import "server-only";

/**
 * Cloudflare Turnstile check for guest submissions. Off until TURNSTILE_SECRET_KEY is set,
 * so local dev and the smoke test keep working without keys.
 */
export function turnstileEnabled() {
  return !!process.env.TURNSTILE_SECRET_KEY;
}

export async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (!token || token.length > 2048) return false;
  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip !== "unknown") body.set("remoteip", ip);
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
      signal: AbortSignal.timeout(8000),
    });
    const json = (await res.json()) as { success?: boolean };
    return json.success === true;
  } catch (e) {
    console.error("[turnstile] verify failed", e);
    return false;
  }
}
