"use client";

// Fetches a fresh, single-use Turnstile token for each POST (tokens expire after 5 minutes,
// so queued offline submissions need a new one when they're retried).

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  remove: (id: string) => void;
};
declare global {
  interface Window { turnstile?: TurnstileApi }
}

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";
const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

let loading: Promise<TurnstileApi> | null = null;

function loadScript(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  loading ??= new Promise<TurnstileApi>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SCRIPT;
    s.async = true;
    s.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("turnstile missing")));
    s.onerror = () => {
      loading = null;
      s.remove();
      reject(new Error("turnstile load failed"));
    };
    document.head.appendChild(s);
  });
  return loading;
}

/** Resolves to "" when Turnstile isn't configured; throws when a token can't be had (treated like being offline). */
export async function turnstileToken(lang: string): Promise<string> {
  if (!SITE_KEY) return "";
  const api = await loadScript();
  // Invisible unless Cloudflare wants an interactive check, in which case it appears above the footer.
  const box = document.createElement("div");
  box.style.cssText = "position:fixed;left:50%;bottom:96px;transform:translateX(-50%);z-index:60";
  document.body.appendChild(box);
  let id = "";
  try {
    return await new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("turnstile timeout")), 60000);
      id = api.render(box, {
        sitekey: SITE_KEY,
        appearance: "interaction-only",
        language: lang === "sw" ? "sw" : "en",
        callback: (t: string) => { clearTimeout(timer); resolve(t); },
        "error-callback": () => { clearTimeout(timer); reject(new Error("turnstile error")); },
        "timeout-callback": () => { clearTimeout(timer); reject(new Error("turnstile timeout")); },
      });
    });
  } finally {
    if (id) api.remove(id);
    box.remove();
  }
}
