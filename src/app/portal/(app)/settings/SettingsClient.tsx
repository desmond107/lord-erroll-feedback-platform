"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { changePassword, confirmTotp, disableTotp, retryAlerts, savePrefs, saveProfile, sendTestDigest, startTotp } from "./actions";

type R = { ok: boolean; error?: string; message?: string; qr?: string; secret?: string };

function useRun() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<R | null>(null);
  const run = (fn: () => Promise<R>, after?: (r: R) => void) =>
    start(async () => {
      const r = await fn();
      setMsg(r);
      if (r.ok) after?.(r);
    });
  const note = msg && <p className={`text-sm ${msg.ok ? "text-green" : "text-crimson"}`}>{msg.ok ? msg.message : msg.error}</p>;
  return { pending, run, note };
}

export function Profile({ name: initial }: { name: string }) {
  const [name, setName] = useState(initial);
  const { pending, run, note } = useRun();
  return (
    <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); run(() => saveProfile(name)); }}>
      <label className="block min-w-60 flex-1"><span className="label">Your name (used to sign replies)</span><input className="field py-2" value={name} onChange={(e) => setName(e.target.value)} /></label>
      <button className="btn btn-green btn-sm" disabled={pending}>Save</button>
      <div className="w-full">{note}</div>
    </form>
  );
}

export function Password() {
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const { pending, run, note } = useRun();
  return (
    <form className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end" onSubmit={(e) => { e.preventDefault(); run(() => changePassword(cur, next), () => { setCur(""); setNext(""); }); }}>
      <label className="block"><span className="label">Current password</span><input type="password" autoComplete="current-password" className="field py-2" value={cur} onChange={(e) => setCur(e.target.value)} required /></label>
      <label className="block"><span className="label">New password</span><input type="password" autoComplete="new-password" className="field py-2" value={next} onChange={(e) => setNext(e.target.value)} minLength={10} required /></label>
      <button className="btn btn-green btn-sm" disabled={pending}>Change</button>
      <div className="sm:col-span-3">{note ?? <p className="text-xs text-muted">At least 10 characters with letters and numbers.</p>}</div>
    </form>
  );
}

export function TwoFactor({ enabled }: { enabled: boolean }) {
  const [setup, setSetup] = useState<{ qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [pw, setPw] = useState("");
  const { pending, run, note } = useRun();
  if (enabled)
    return (
      <div className="space-y-3">
        <p className="text-sm"><span className="text-green">●</span> On. You&apos;ll be asked for a code from your authenticator app at each sign-in.</p>
        <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); run(() => disableTotp(pw)); }}>
          <label className="block"><span className="label">Password to turn off</span><input type="password" className="field py-2" value={pw} onChange={(e) => setPw(e.target.value)} required /></label>
          <button className="btn btn-ghost btn-sm text-crimson" disabled={pending}>Turn off 2FA</button>
        </form>
        {note}
      </div>
    );
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">Add a six-digit code from Google Authenticator, Microsoft Authenticator or 1Password to every sign-in. Strongly recommended for owners.</p>
      {!setup ? (
        <button type="button" className="btn btn-green btn-sm" disabled={pending} onClick={() => run(startTotp, (r) => setSetup({ qr: r.qr!, secret: r.secret! }))}>Set up two-factor</button>
      ) : (
        <div className="flex flex-wrap items-start gap-5">
          <Image src={setup.qr} alt="Scan with your authenticator app" width={180} height={180} unoptimized className="rounded-lg border border-line" />
          <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); run(() => confirmTotp(code)); }}>
            <p className="text-sm">1. Scan the code with your app.<br />2. Enter the six digits it shows.</p>
            <p className="text-xs text-muted">Can&apos;t scan? Key: <span className="font-mono select-all">{setup.secret}</span></p>
            <input className="field w-40 py-2 text-center tracking-[0.3em]" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" />
            <button className="btn btn-green btn-sm ml-2" disabled={pending || code.length < 6}>Confirm</button>
          </form>
        </div>
      )}
      {note}
    </div>
  );
}

export function Prefs({ initial }: { initial: { notifyInstant: boolean; digestDaily: boolean; digestWeekly: boolean; digestMonthly: boolean } }) {
  const [p, setP] = useState(initial);
  const { pending, run, note } = useRun();
  const row = (k: keyof typeof p, title: string, desc: string) => (
    <label className="flex cursor-pointer items-start gap-3 py-2.5">
      <input type="checkbox" className="mt-1 h-4 w-4 accent-[var(--green)]" checked={p[k]} onChange={(e) => setP({ ...p, [k]: e.target.checked })} />
      <span><span className="font-medium">{title}</span><br /><span className="text-sm text-muted">{desc}</span></span>
    </label>
  );
  return (
    <div>
      <div className="divide-y divide-line">
        {row("notifyInstant", "Email me every new submission", "The full feedback, the moment it arrives. (Addresses in OWNER_NOTIFY_EMAILS always receive these.)")}
        {row("digestDaily", "Daily digest", "Each morning at 8:00 — yesterday's feedback at a glance.")}
        {row("digestWeekly", "Weekly digest", "Monday mornings — the past seven days, by section and staff.")}
        {row("digestMonthly", "Monthly report", "First of the month — a PDF report with the crest, ready to share.")}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" className="btn btn-green btn-sm" disabled={pending} onClick={() => run(() => savePrefs(p))}>Save preferences</button>
        <span className="text-xs text-muted">Send me a sample now:</span>
        {(["daily", "weekly", "monthly"] as const).map((k) => (
          <button key={k} type="button" className="btn btn-ghost btn-sm capitalize" disabled={pending} onClick={() => run(() => sendTestDigest(k))}>{k}</button>
        ))}
      </div>
      <div className="mt-2">{note}</div>
    </div>
  );
}

export function RetryButton({ feedbackId }: { feedbackId: string }) {
  const { pending, run, note } = useRun();
  return (
    <span className="inline-flex items-center gap-2">
      <button type="button" className="text-xs text-green underline" disabled={pending} onClick={() => run(() => retryAlerts(feedbackId))}>{pending ? "Retrying…" : "Retry"}</button>
      {note}
    </span>
  );
}
