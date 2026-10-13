"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Image from "next/image";
import { logoutAction } from "@/app/portal/login/actions";

type Item = { href: string; label: string; icon: keyof typeof ICONS; badge?: "unread" };

const ICONS = {
  inbox: "M4 13h4l2 3h4l2-3h4M4 13l2-8h12l2 8v6H4z",
  chart: "M4 20V10m6 10V4m6 16v-7m4 7H2",
  qr: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2z",
  team: "M16 19v-1a4 4 0 0 0-8 0v1M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM20 19v-1a3 3 0 0 0-2-2.8M4 19v-1a3 3 0 0 1 2-2.8",
  log: "M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01",
  cog: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7.6 7.6 0 0 0-2-1.2L14.5 3h-5l-.4 2.6a7.6 7.6 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7.6 7.6 0 0 0 2 1.2l.4 2.6h5l.4-2.6a7.6 7.6 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2Z",
};

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

export default function PortalNav({
  user, items, initial,
}: { user: { name: string; role: string }; items: Item[]; initial: { unread: number; urgentOpen: number } }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [c, setC] = useState(initial);
  const [perm, setPerm] = useState<string>("unsupported");
  useEffect(() => setPerm(typeof Notification === "undefined" ? "unsupported" : Notification.permission), []);

  useEffect(() => {
    const on = (e: Event) => {
      const p = (e as CustomEvent).detail;
      setC({ unread: p.unread, urgentOpen: p.urgentOpen });
    };
    window.addEventListener("le-pulse", on);
    return () => window.removeEventListener("le-pulse", on);
  }, []);
  useEffect(() => setOpen(false), [path]);

  const active = (href: string) => (href === "/portal" ? path === "/portal" || path.startsWith("/portal/feedback") : path.startsWith(href));

  const nav = (
    <nav className="flex flex-col gap-0.5">
      {items.map((it) => (
        <Link
          key={it.href}
          href={it.href}
          className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-[0.93rem] transition-colors ${
            active(it.href) ? "bg-green text-on-accent" : "text-ink hover:bg-gold-soft"
          }`}
        >
          <Icon d={ICONS[it.icon]} />
          <span className="flex-1">{it.label}</span>
          {it.badge === "unread" && c.unread > 0 && (
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${active(it.href) ? "bg-on-accent/20" : "bg-crimson text-white"}`}>{c.unread}</span>
          )}
        </Link>
      ))}
    </nav>
  );

  const brand = (
    <Link href="/portal" className="flex items-center gap-3 px-2">
      <Image src="/brand/crest-240.png" alt="" width={34} height={38} />
      <div>
        <div className="font-serif text-xl leading-none font-semibold">The Lord Erroll</div>
        <div className="mt-1 text-[0.6rem] tracking-[0.28em] text-gold-ink uppercase">Owner portal</div>
      </div>
    </Link>
  );

  const footer = (
    <div className="border-t border-line pt-4">
      {c.urgentOpen > 0 && (
        <Link href="/portal?rating=urgent&status=OPEN" className="mb-3 flex items-center gap-2 rounded-lg bg-crimson-soft px-3 py-2 text-sm text-crimson">
          <span className="pulse-dot h-2 w-2 rounded-full bg-crimson" />
          {c.urgentOpen} urgent awaiting action
        </Link>
      )}
      {perm === "default" && (
        <button type="button" onClick={async () => setPerm(await Notification.requestPermission())} className="mb-3 w-full rounded-lg border border-gold/60 px-3 py-2 text-left text-sm hover:bg-gold-soft">
          🔔 Turn on desktop alerts
          <span className="block text-xs text-muted">Get a pop-up and chime for every new feedback.</span>
        </button>
      )}
      <div className="px-2 text-sm font-medium">{user.name}</div>
      <div className="px-2 text-xs text-muted">{user.role}</div>
      <form action={logoutAction}>
        <button className="mt-2 px-2 text-sm text-muted underline-offset-4 hover:text-crimson hover:underline">Sign out</button>
      </form>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="no-print sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-6 border-r border-line bg-surface px-4 py-6 lg:flex">
        {brand}
        <div className="gold-rule px-2" aria-hidden />
        <div className="flex-1">{nav}</div>
        {footer}
      </aside>

      {/* Mobile top bar */}
      <div className="no-print sticky top-0 z-30 flex items-center justify-between border-b border-line bg-surface/95 px-4 py-2.5 backdrop-blur lg:hidden">
        {brand}
        <div className="flex items-center gap-2">
          {c.unread > 0 && (
            <Link href="/portal?view=unread" className="rounded-full bg-crimson px-2.5 py-1 text-xs font-semibold text-white tabular-nums">
              {c.unread} new
            </Link>
          )}
          <button type="button" onClick={() => setOpen(true)} className="btn btn-ghost btn-sm" aria-label="Open menu">
            ☰
          </button>
        </div>
      </div>
      {open && (
        <div className="no-print fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true">
          <button type="button" aria-label="Close menu" className="anim-fade absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="anim-rise absolute top-0 right-0 flex h-full w-72 flex-col gap-6 bg-surface px-4 py-6 shadow-soft">
            {brand}
            <div className="flex-1">{nav}</div>
            {footer}
          </div>
        </div>
      )}
    </>
  );
}
