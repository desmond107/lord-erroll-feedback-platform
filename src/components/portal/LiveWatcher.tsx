"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Fresh = { id: string; ref: string; urgent: boolean; title: string; body: string };
type Pulse = { unread: number; urgentOpen: number; followUps: number; latest: number; fresh: Fresh[] };

const POLL_MS = 10000;

function chime(urgent: boolean) {
  try {
    const ctx = new AudioContext();
    const notes = urgent ? [660, 520, 660] : [784, 1047];
    notes.forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = f;
      const t = ctx.currentTime + i * 0.18;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + 0.55);
    });
  } catch {
    /* audio blocked until the user interacts */
  }
}

/** Keeps the portal live: new submissions show a toast, a chime and a desktop notification. */
export default function LiveWatcher({ initialLatest, onCounts }: { initialLatest: number; onCounts?: (p: Pulse) => void }) {
  const router = useRouter();
  const latest = useRef(initialLatest);
  const [toasts, setToasts] = useState<Fresh[]>([]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let stopped = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/portal/pulse?after=${latest.current}`, { cache: "no-store" });
        if (res.status === 401) return window.location.assign("/portal/login");
        if (res.ok) {
          const p: Pulse = await res.json();
          onCounts?.(p);
          window.dispatchEvent(new CustomEvent("le-pulse", { detail: p }));
          if (p.fresh.length) {
            latest.current = Math.max(latest.current, p.latest);
            setToasts((t) => [...p.fresh.reverse(), ...t].slice(0, 4));
            chime(p.fresh.some((f) => f.urgent));
            if (typeof Notification !== "undefined" && Notification.permission === "granted") {
              for (const f of p.fresh) {
                const n = new Notification(`${f.ref} · ${f.title}`, { body: f.body, icon: "/icon-192.png", tag: f.id, requireInteraction: f.urgent });
                n.onclick = () => {
                  window.focus();
                  router.push(`/portal/feedback/${f.id}`);
                };
              }
            }
            router.refresh();
          } else if (p.latest > latest.current) latest.current = p.latest;
        }
      } catch {
        /* offline — try again next tick */
      }
      if (!stopped) timer = setTimeout(tick, document.hidden ? POLL_MS * 3 : POLL_MS);
    };
    timer = setTimeout(tick, POLL_MS);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [router, onCounts]);

  return (
    <>
      <div className="no-print fixed top-3 right-3 left-3 z-50 flex flex-col items-end gap-2 sm:left-auto sm:w-96" aria-live="assertive">
        {toasts.map((t) => (
          <div key={t.id} className={`anim-rise card w-full border-l-4 p-3.5 ${t.urgent ? "border-l-crimson" : "border-l-gold"}`}>
            <div className="flex items-start justify-between gap-2">
              <Link href={`/portal/feedback/${t.id}`} onClick={() => setToasts((all) => all.filter((x) => x.id !== t.id))} className="min-w-0">
                <div className={`text-xs font-semibold tracking-wide uppercase ${t.urgent ? "text-crimson" : "text-gold-ink"}`}>New feedback · {t.ref}</div>
                <div className="mt-0.5 font-medium">{t.title}</div>
                <div className="mt-0.5 line-clamp-2 text-sm text-muted">{t.body}</div>
              </Link>
              <button type="button" aria-label="Dismiss" className="text-muted" onClick={() => setToasts((all) => all.filter((x) => x.id !== t.id))}>
                ×
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
