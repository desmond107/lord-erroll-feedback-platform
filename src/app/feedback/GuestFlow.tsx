"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { COPY, type Lang } from "@/lib/i18n";
import { CATEGORIES, HIGHLIGHTS, IMPROVEMENTS, OCCASIONS, RATING_LABELS, RESTAURANT, SECTIONS } from "@/lib/config";
import { Crest, CrownIcon, Fleur, GoldRule } from "@/components/brand";
import {
  COOLDOWN_MS, type Draft, type Photo, clearDraft, compressImage, flushOutbox, lastSubmission, loadDraft,
  markSubmitted, preferredLang, recordScan, saveDraft, saveLang, submitFeedback, todayKey, uuid,
} from "./guest-utils";

type Links = { googleReview: string; instagram: string; facebook: string; tripadvisor: string };

const TOTAL = 8; // question steps between welcome (0) and thank-you (9)
const THANKS = 9;

function blankDraft(section: string, table: string, lang: Lang): Draft {
  return {
    v: 1, clientId: uuid(), startedAt: Date.now(), savedAt: Date.now(), step: 0, lang,
    section, table, occasion: null, visitDate: todayKey(), overall: null, ratings: {},
    highlights: [], improvements: [], staffName: "", staffMessage: "", suggestion: "", nps: null,
    guestName: "", guestEmail: "", guestPhone: "", followUp: false,
  };
}

export default function GuestFlow({ qrSection, qrTable, links }: { qrSection: string; qrTable: string; links: Links }) {
  const [d, setD] = useState<Draft | null>(null);
  const [resumed, setResumed] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [dir, setDir] = useState<1 | -1>(1);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [queued, setQueued] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const honeypot = useRef<HTMLInputElement>(null);
  const top = useRef<HTMLDivElement>(null);

  // Hydrate from saved draft (progress survives closing the tab) or start fresh.
  useEffect(() => {
    const lang = preferredLang();
    const saved = loadDraft();
    const sameTable = saved && (!qrSection || (saved.section === qrSection && saved.table === (qrTable || saved.table)));
    if (saved && sameTable && saved.step > 0 && saved.step < THANKS) {
      setD(saved);
      setResumed(true);
    } else {
      setD(blankDraft(qrSection, qrTable, lang));
    }
    const last = lastSubmission();
    if (last && Date.now() - last.at < COOLDOWN_MS && last.section === qrSection && last.table === qrTable) setBlocked(true);
    if (qrSection) recordScan(qrSection, qrTable);
    flushOutbox();
    const onOnline = () => flushOutbox();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [qrSection, qrTable]);

  useEffect(() => {
    if (d && d.step > 0 && d.step < THANKS) saveDraft(d);
  }, [d]);

  useEffect(() => {
    if (d) document.documentElement.lang = d.lang;
  }, [d]);

  const t = COPY[d?.lang ?? "en"];
  const set = useCallback(<K extends keyof Draft>(k: K, v: Draft[K]) => setD((p) => (p ? { ...p, [k]: v } : p)), []);

  const stepRef = useRef(0);
  stepRef.current = d?.step ?? 0;
  const go = useCallback((step: number) => {
    setDir(step >= stepRef.current ? 1 : -1);
    setD((p) => (p ? { ...p, step } : p));
    setHint(null);
    setError(null);
    requestAnimationFrame(() => top.current?.scrollIntoView({ block: "start" }));
  }, []);

  if (!d) {
    return (
      <div className="flex min-h-dvh items-center justify-center paper">
        <Crest size={84} priority className="anim-shimmer" />
      </div>
    );
  }

  const lang = d.lang;
  const toggleLang = () => {
    const next: Lang = lang === "en" ? "sw" : "en";
    saveLang(next);
    set("lang", next);
  };

  const canContinue = () => {
    if (d.step === 1) return !!d.section && !!d.visitDate;
    if (d.step === 2) return !!d.overall;
    return true;
  };
  const next = () => {
    if (!canContinue()) {
      setHint(d.step === 2 ? t.overallHint : null);
      return;
    }
    go(d.step + 1);
  };

  const submit = async () => {
    if (d.followUp && !d.guestEmail && !d.guestPhone) {
      setError(t.followUpNeedsContact);
      return;
    }
    setBusy(true);
    setError(null);
    const payload = {
      clientId: d.clientId, lang: d.lang, section: d.section, table: d.table || null, occasion: d.occasion,
      visitDate: d.visitDate, overall: d.overall, ratings: d.ratings, highlights: d.highlights, improvements: d.improvements,
      staffName: d.staffName, staffMessage: d.staffMessage, suggestion: d.suggestion, nps: d.nps,
      guestName: d.guestName, guestEmail: d.guestEmail, guestPhone: d.guestPhone, followUp: d.followUp,
      startedAt: d.startedAt, website: honeypot.current?.value || undefined,
    };
    const out = await submitFeedback(payload, photos.map((p) => p.blob));
    setBusy(false);
    if (out.kind === "error") {
      setError(out.code === "too_fast" ? t.errorSpam : out.code === "rate_limited" ? t.errorRate : t.errorGeneric);
      return;
    }
    setQueued(out.kind === "queued");
    markSubmitted(qrSection || d.section, qrTable || d.table);
    clearDraft();
    photos.forEach((p) => URL.revokeObjectURL(p.url));
    go(THANKS);
  };

  const restart = () => {
    clearDraft();
    setPhotos([]);
    setResumed(false);
    setBlocked(false);
    setQueued(false);
    setD(blankDraft(qrSection, qrTable, lang));
  };

  const progress = d.step >= 1 && d.step <= TOTAL ? d.step / TOTAL : d.step === THANKS ? 1 : 0;
  const anim = dir === 1 ? "anim-rise" : "anim-rise-back";

  return (
    <div className="paper min-h-dvh">
      <div ref={top} className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
        {/* Header */}
        <header className="flex items-center justify-between gap-3 py-2">
          {d.step > 0 && d.step < THANKS ? (
            <button type="button" onClick={() => go(d.step - 1)} className="btn btn-ghost btn-sm -ml-1" aria-label={t.back}>
              <span aria-hidden>‹</span> {t.back}
            </button>
          ) : (
            <span />
          )}
          <button type="button" onClick={toggleLang} className="btn btn-ghost btn-sm" aria-label={`Switch language to ${t.switchTo}`}>
            {t.switchTo}
          </button>
        </header>

        {d.step > 0 && d.step <= TOTAL && (
          <div className="mt-2 mb-6" aria-live="polite">
            <div className="mb-2 flex items-center justify-between text-xs tracking-wide text-muted">
              <span>{t.stepOf(d.step, TOTAL)}</span>
              <Crest size={22} />
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuemin={0} aria-valuemax={TOTAL} aria-valuenow={d.step}>
              <div className="h-full rounded-full bg-gold transition-[width] duration-500 ease-out" style={{ width: `${progress * 100}%` }} />
            </div>
          </div>
        )}

        <main key={`${d.step}-${lang}`} className={`flex flex-1 flex-col ${anim}`}>
          {d.step === 0 &&
            (blocked ? (
              <Already t={t} onAnother={() => setBlocked(false)} />
            ) : (
              <Welcome t={t} resumed={resumed} onStart={() => go(resumed ? d.step || 1 : 1)} onRestart={restart} />
            ))}

          {d.step === 1 && (
            <Step title={t.visitTitle} line={t.visitLine}>
              <fieldset>
                <legend className="label">{t.section}</legend>
                <div className="grid grid-cols-2 gap-2.5">
                  {SECTIONS.map((s) => (
                    <button
                      key={s.slug}
                      type="button"
                      aria-pressed={d.section === s.slug}
                      onClick={() => set("section", s.slug)}
                      className="chip min-h-14 justify-center rounded-xl text-center leading-tight"
                    >
                      {s[lang]}
                    </button>
                  ))}
                </div>
              </fieldset>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="label">{t.table}</span>
                  <input
                    className="field"
                    inputMode="numeric"
                    maxLength={8}
                    placeholder={t.tablePlaceholder}
                    value={d.table}
                    onChange={(e) => set("table", e.target.value.replace(/[^A-Za-z0-9-]/g, ""))}
                  />
                </label>
                <label className="block">
                  <span className="label">{t.date}</span>
                  <input className="field" type="date" max={todayKey()} value={d.visitDate} onChange={(e) => set("visitDate", e.target.value)} />
                </label>
              </div>
              <fieldset>
                <legend className="label">{t.occasion}</legend>
                <div className="flex flex-wrap gap-2">
                  {OCCASIONS.map((o) => (
                    <button key={o.key} type="button" className="chip" aria-pressed={d.occasion === o.key} onClick={() => set("occasion", d.occasion === o.key ? null : o.key)}>
                      {o[lang]}
                    </button>
                  ))}
                </div>
              </fieldset>
            </Step>
          )}

          {d.step === 2 && (
            <Step title={t.overallTitle} line={t.overallLine} center>
              <CrownRating
                value={d.overall}
                size="lg"
                labels={RATING_LABELS[lang]}
                onChange={(v) => {
                  set("overall", v);
                  setHint(null);
                  window.setTimeout(() => go(3), 750);
                }}
              />
              <div className="flex h-12 items-center justify-center">
                {d.overall ? (
                  <p key={d.overall} className="anim-rise font-serif text-3xl font-semibold text-gold-ink italic">
                    {RATING_LABELS[lang][d.overall]}
                  </p>
                ) : (
                  <GoldRule className="w-40" />
                )}
              </div>
              {hint && <p className="text-center text-sm text-crimson">{hint}</p>}
            </Step>
          )}

          {d.step === 3 && (
            <Step title={t.detailTitle} line={t.detailLine}>
              <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
                {CATEGORIES.map((c) => (
                  <li key={c.key} className="flex items-center justify-between gap-2 px-3.5 py-2.5">
                    <span className="text-[0.95rem]">{c[lang]}</span>
                    <CrownRating
                      value={d.ratings[c.key] ?? null}
                      size="sm"
                      labels={RATING_LABELS[lang]}
                      label={c[lang]}
                      onChange={(v) => set("ratings", { ...d.ratings, [c.key]: d.ratings[c.key] === v ? null : v })}
                    />
                  </li>
                ))}
              </ul>
            </Step>
          )}

          {d.step === 4 && (
            <Step title={t.chipsTitle} line={t.chipsLine}>
              <ChipSet
                options={HIGHLIGHTS.map((h) => ({ key: h.key, label: h[lang] }))}
                value={d.highlights}
                onChange={(v) => set("highlights", v)}
              />
              <h2 className="mt-4 font-serif text-2xl font-semibold">{t.improveTitle}</h2>
              <ChipSet
                bad
                options={IMPROVEMENTS.map((h) => ({ key: h.key, label: h[lang] }))}
                value={d.improvements}
                onChange={(v) => set("improvements", v)}
              />
            </Step>
          )}

          {d.step === 5 && (
            <Step title={t.staffTitle} line={t.staffLine} badge={t.optional}>
              <label className="block">
                <span className="label">{t.staffName}</span>
                <input className="field" maxLength={80} placeholder={t.staffNamePlaceholder} value={d.staffName} onChange={(e) => set("staffName", e.target.value)} />
              </label>
              <label className="block">
                <span className="label">{t.staffMessage}</span>
                <textarea className="field min-h-28" maxLength={500} placeholder={t.staffMessagePlaceholder} value={d.staffMessage} onChange={(e) => set("staffMessage", e.target.value)} />
              </label>
            </Step>
          )}

          {d.step === 6 && (
            <Step title={t.suggestTitle} line={t.suggestLine} badge={t.optional}>
              <SuggestionBox t={t} lang={lang} value={d.suggestion} onChange={(v) => set("suggestion", v)} />
              <PhotoPicker t={t} photos={photos} setPhotos={setPhotos} />
            </Step>
          )}

          {d.step === 7 && (
            <Step title={t.npsTitle}>
              <div className="grid grid-cols-6 gap-2 sm:grid-cols-11" role="radiogroup" aria-label={t.npsTitle}>
                {Array.from({ length: 11 }, (_, n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={d.nps === n}
                    onClick={() => set("nps", n)}
                    className={`h-12 rounded-lg border text-lg font-semibold transition-colors ${
                      d.nps === n
                        ? n >= 9 ? "border-green bg-green text-on-accent" : n >= 7 ? "border-gold bg-gold text-[#1f2421]" : "border-crimson bg-crimson text-on-accent"
                        : "border-line bg-surface hover:border-gold"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <div className="flex justify-between text-xs text-muted">
                <span>0 · {t.npsLow}</span>
                <span>{t.npsHigh} · 10</span>
              </div>
            </Step>
          )}

          {d.step === 8 && (
            <Step title={t.contactTitle} line={t.contactLine}>
              <label className="block">
                <span className="label">{t.name}</span>
                <input className="field" autoComplete="name" maxLength={100} value={d.guestName} onChange={(e) => set("guestName", e.target.value)} />
              </label>
              <label className="block">
                <span className="label">{t.phone}</span>
                <input className="field" type="tel" autoComplete="tel" inputMode="tel" maxLength={30} placeholder="+254 7…" value={d.guestPhone} onChange={(e) => set("guestPhone", e.target.value)} />
              </label>
              <label className="block">
                <span className="label">{t.email}</span>
                <input className="field" type="email" autoComplete="email" maxLength={200} value={d.guestEmail} onChange={(e) => set("guestEmail", e.target.value)} />
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-surface p-3.5">
                <input type="checkbox" className="mt-0.5 h-5 w-5 accent-[var(--green)]" checked={d.followUp} onChange={(e) => set("followUp", e.target.checked)} />
                <span className="text-[0.95rem]">{t.followUp}</span>
              </label>
              {/* Honeypot: hidden from people and assistive tech, irresistible to bots. */}
              <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
                <label>
                  Website <input ref={honeypot} tabIndex={-1} autoComplete="off" name="website" />
                </label>
              </div>
              {!d.guestName && !d.guestEmail && !d.guestPhone && <p className="text-sm text-muted italic">{t.anonymousNote}</p>}
              <p className="text-xs leading-relaxed text-muted">{t.privacy}</p>
            </Step>
          )}

          {d.step === THANKS && (
            <Thanks t={t} overall={d.overall ?? 5} hasContact={!!(d.guestEmail || d.guestPhone)} queued={queued} links={links} onAnother={restart} />
          )}
        </main>

        {/* Footer actions */}
        {d.step > 0 && d.step <= TOTAL && (
          <footer className="sticky bottom-0 mt-8 -mx-5 bg-gradient-to-t from-bg via-bg to-transparent px-5 pt-6 pb-2">
            {error && (
              <p role="alert" className="mb-3 rounded-lg bg-crimson-soft px-3 py-2 text-sm text-crimson">
                {error}
              </p>
            )}
            {d.step < TOTAL ? (
              <div className="flex gap-3">
                {(d.step === 5 || d.step === 6 || d.step === 7) && (
                  <button type="button" className="btn btn-ghost flex-1" onClick={() => go(d.step + 1)}>
                    {t.skip}
                  </button>
                )}
                {(d.step !== 2 || !!d.overall) && (
                  <button type="button" className="btn btn-green flex-[2]" onClick={next} disabled={!canContinue()}>
                    {t.next}
                  </button>
                )}
              </div>
            ) : (
              <button type="button" className="btn btn-gold w-full text-base" onClick={submit} disabled={busy}>
                {busy ? t.sending : t.submit}
              </button>
            )}
          </footer>
        )}

        {(d.step === 0 || d.step === THANKS) && (
          <footer className="mt-10 text-center text-xs leading-relaxed text-muted">
            {RESTAURANT.fullName}
            <br />
            {RESTAURANT.address} · <a className="underline-offset-2 hover:underline" href={RESTAURANT.phoneHref}>{RESTAURANT.phone}</a>
          </footer>
        )}
      </div>
    </div>
  );
}

// ─── Pieces ─────────────────────────────────────────────────────────────

type T = (typeof COPY)["en"];

function Step({ title, line, badge, center, children }: { title: string; line?: string; badge?: string; center?: boolean; children: React.ReactNode }) {
  return (
    <section className={`flex flex-col gap-5 ${center ? "flex-1 items-center justify-center text-center" : ""}`}>
      <div className={center ? "" : ""}>
        {badge && <span className="mb-2 inline-block rounded-full bg-gold-soft px-2.5 py-0.5 text-[0.7rem] tracking-wider text-gold-ink uppercase">{badge}</span>}
        <h1 className="font-serif text-[2rem] leading-[1.1] font-semibold text-balance">{title}</h1>
        {line && <p className="mt-2 text-[0.95rem] leading-relaxed text-muted">{line}</p>}
      </div>
      {children}
    </section>
  );
}

function Welcome({ t, resumed, onStart, onRestart }: { t: T; resumed: boolean; onStart: () => void; onRestart: () => void }) {
  return (
    <section className="flex flex-1 flex-col items-center justify-center py-6 text-center">
      <div className="anim-fade">
        <Crest size={150} priority />
      </div>
      <div className="mt-5 font-serif text-[2.1rem] leading-none font-semibold tracking-wide">The Lord Erroll</div>
      <div className="mt-1.5 text-[0.68rem] tracking-[0.34em] text-gold-ink uppercase">Gourmet Restaurant</div>
      <GoldRule className="my-7 w-48" />
      <h1 className="font-serif text-[1.75rem] leading-tight font-semibold text-balance italic">{t.welcomeTitle}</h1>
      <p className="mt-3 max-w-xs text-[1.02rem] leading-relaxed text-muted">{t.welcomeLine}</p>
      {resumed && <p className="mt-5 rounded-lg bg-green-soft px-3 py-2 text-sm text-green">{t.resumeNote}</p>}
      <button type="button" onClick={onStart} className="btn btn-gold mt-8 w-full max-w-xs text-base">
        {t.welcomeCta}
      </button>
      {resumed && (
        <button type="button" onClick={onRestart} className="mt-3 text-sm text-muted underline underline-offset-4">
          {t.startOver}
        </button>
      )}
      <p className="mt-5 text-xs text-muted">{t.welcomeTime}</p>
    </section>
  );
}

function Already({ t, onAnother }: { t: T; onAnother: () => void }) {
  return (
    <section className="flex flex-1 flex-col items-center justify-center py-6 text-center">
      <Crest size={110} />
      <GoldRule className="my-6 w-40" />
      <h1 className="font-serif text-3xl font-semibold">{t.alreadyTitle}</h1>
      <p className="mt-3 max-w-xs leading-relaxed text-muted">{t.alreadyLine}</p>
      <button type="button" onClick={onAnother} className="btn btn-ghost mt-8">
        {t.alreadyAnother}
      </button>
    </section>
  );
}

function CrownRating({
  value, onChange, size, labels, label,
}: { value: number | null; onChange: (v: number) => void; size: "lg" | "sm"; labels: readonly string[]; label?: string }) {
  const [popped, setPopped] = useState<number | null>(null);
  const cls = size === "lg" ? "h-14 w-14 sm:h-16 sm:w-16" : "h-7 w-7";
  return (
    <div className={`flex ${size === "lg" ? "gap-1.5" : "gap-0.5"}`} role="radiogroup" aria-label={label}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} — ${labels[n]}`}
          onClick={() => {
            setPopped(n);
            onChange(n);
          }}
          className={`grid place-items-center rounded-lg text-gold-ink/50 transition-transform ${size === "lg" ? "p-1" : "p-1 -m-0.5"} ${popped === n ? "anim-pop" : ""}`}
          onAnimationEnd={() => setPopped(null)}
        >
          <CrownIcon filled={!!value && n <= value} className={cls} />
        </button>
      ))}
    </div>
  );
}

function ChipSet({ options, value, onChange, bad }: { options: { key: string; label: string }[]; value: string[]; onChange: (v: string[]) => void; bad?: boolean }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = value.includes(o.key);
        return (
          <button
            key={o.key}
            type="button"
            aria-pressed={on}
            className={`chip ${bad ? "chip-bad" : ""}`}
            onClick={() => onChange(on ? value.filter((k) => k !== o.key) : [...value, o.key])}
          >
            {on && <span aria-hidden>✓</span>}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

type SpeechRec = {
  lang: string; continuous: boolean; interimResults: boolean;
  start: () => void; stop: () => void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null; onerror: (() => void) | null;
};

function SuggestionBox({ t, lang, value, onChange }: { t: T; lang: Lang; value: string; onChange: (v: string) => void }) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const rec = useRef<SpeechRec | null>(null);
  const base = useRef("");

  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
    setSupported(!!(w.SpeechRecognition || w.webkitSpeechRecognition));
    return () => rec.current?.stop();
  }, []);

  const toggle = () => {
    if (listening) {
      rec.current?.stop();
      return;
    }
    const w = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) return setSupported(false);
    const r = new Ctor();
    r.lang = lang === "sw" ? "sw-KE" : "en-KE";
    r.continuous = true;
    r.interimResults = true;
    base.current = value ? value.replace(/\s*$/, " ") : "";
    r.onresult = (e) => {
      let finalText = "";
      let interim = "";
      for (let i = 0; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) finalText += res[0].transcript;
        else interim += res[0].transcript;
      }
      onChange((base.current + finalText + interim).slice(0, 4000));
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    rec.current = r;
    r.start();
    setListening(true);
  };

  return (
    <div className="relative">
      <textarea
        className="field min-h-48 pb-14 text-[1.02rem] leading-relaxed"
        maxLength={4000}
        placeholder={t.suggestPlaceholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={t.suggestTitle}
      />
      <div className="absolute right-3 bottom-3 left-3 flex items-center justify-between gap-2">
        <span className="text-xs text-muted tabular-nums">{value.length > 3500 ? `${value.length}/4000` : ""}</span>
        {supported ? (
          <button type="button" onClick={toggle} className={`btn btn-sm ${listening ? "bg-crimson text-on-accent" : "btn-ghost"}`} aria-pressed={listening}>
            <MicIcon />
            {listening ? t.listening : t.speak}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" strokeLinecap="round" />
    </svg>
  );
}

function PhotoPicker({ t, photos, setPhotos }: { t: T; photos: Photo[]; setPhotos: (fn: (p: Photo[]) => Photo[]) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [working, setWorking] = useState(false);
  const slow = useMemo(() => {
    const c = (navigator as unknown as { connection?: { effectiveType?: string; saveData?: boolean } }).connection;
    return !!c && (c.saveData || /2g|3g/.test(c.effectiveType || ""));
  }, []);

  const add = async (files: FileList | null) => {
    if (!files?.length) return;
    setWorking(true);
    const room = 3 - photos.length;
    const picked = [...files].filter((f) => f.type.startsWith("image/")).slice(0, room);
    const out: Photo[] = [];
    for (const f of picked) {
      try {
        const blob = await compressImage(f, slow ? 1200 : 1600, slow ? 0.7 : 0.8);
        if (blob.size <= 2.5 * 1024 * 1024) out.push({ id: uuid(), blob, url: URL.createObjectURL(blob) });
      } catch {
        /* unreadable image — skip */
      }
    }
    setPhotos((p) => [...p, ...out].slice(0, 3));
    setWorking(false);
    if (input.current) input.current.value = "";
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        {photos.map((p) => (
          <div key={p.id} className="relative h-20 w-20 overflow-hidden rounded-lg border border-line">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              aria-label={t.removePhoto}
              onClick={() => {
                URL.revokeObjectURL(p.url);
                setPhotos((all) => all.filter((x) => x.id !== p.id));
              }}
              className="absolute top-1 right-1 grid h-6 w-6 place-items-center rounded-full bg-black/60 text-sm text-white"
            >
              ×
            </button>
          </div>
        ))}
        {photos.length < 3 && (
          <button type="button" onClick={() => input.current?.click()} className="btn btn-ghost btn-sm h-20 rounded-lg border-dashed" disabled={working}>
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
              <path d="M4 8h3l2-3h6l2 3h3v11H4z" strokeLinejoin="round" />
              <circle cx="12" cy="13" r="3.5" />
            </svg>
            {working ? "…" : t.addPhoto}
          </button>
        )}
      </div>
      <p className="mt-2 text-xs text-muted">{t.photoLimit}</p>
      <input ref={input} type="file" accept="image/*" multiple className="hidden" onChange={(e) => add(e.target.files)} />
    </div>
  );
}

function Flourish() {
  return (
    <svg viewBox="0 0 320 60" className="mx-auto w-64 text-gold" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
      <path className="anim-draw" d="M10 30c40 0 60-22 95-22 22 0 30 14 18 22-10 7-26-2-18-12M310 30c-40 0-60-22-95-22-22 0-30 14-18 22 10 7 26-2 18-12" />
      <path className="anim-draw" style={{ animationDelay: "0.4s" }} d="M40 38c40 10 80 14 120 14s80-4 120-14" />
    </svg>
  );
}

function Thanks({
  t, overall, hasContact, queued, links, onAnother,
}: { t: T; overall: number; hasContact: boolean; queued: boolean; links: Links; onAnother: () => void }) {
  const high = overall >= 4;
  return (
    <section className="flex flex-1 flex-col items-center justify-center py-6 text-center">
      <Crest size={112} />
      <div className="mt-5">
        <Flourish />
      </div>
      <h1 className="anim-rise mt-3 font-serif text-[2.1rem] leading-tight font-semibold italic" style={{ animationDelay: "0.5s" }}>
        {t.thanksTitle}
      </h1>
      <div className="anim-rise mt-4 max-w-sm space-y-3 leading-relaxed text-muted" style={{ animationDelay: "0.8s" }}>
        {high ? (
          <p>{t.thanksHigh}</p>
        ) : (
          <>
            <p>{t.thanksLow}</p>
            <p className="text-ink">{hasContact ? t.thanksLowPromise : t.thanksLowNoContact}</p>
            {!hasContact && (
              <p className="flex flex-col gap-1 text-ink">
                <a className="font-semibold text-green" href={RESTAURANT.phoneHref}>{RESTAURANT.phone}</a>
                <a className="font-semibold text-green" href={`mailto:${RESTAURANT.email}`}>{RESTAURANT.email}</a>
              </p>
            )}
          </>
        )}
        {queued && <p className="rounded-lg bg-gold-soft px-3 py-2 text-sm text-gold-ink">{t.thanksQueued}</p>}
      </div>

      {high && (
        <div className="anim-rise mt-8 flex w-full max-w-xs flex-col gap-3" style={{ animationDelay: "1.1s" }}>
          <p className="font-serif text-lg italic">{t.thanksReviewAsk}</p>
          <a href={links.googleReview} target="_blank" rel="noopener" className="btn btn-gold w-full">
            <GoogleG /> {t.thanksReview}
          </a>
          <a href={links.instagram} target="_blank" rel="noopener" className="btn btn-ghost w-full">
            <InstagramIcon /> {t.thanksFollow}
          </a>
          {(links.facebook || links.tripadvisor) && (
            <div className="flex justify-center gap-4 text-sm">
              {links.facebook && <a className="text-green underline-offset-4 hover:underline" href={links.facebook} target="_blank" rel="noopener">Facebook</a>}
              {links.tripadvisor && <a className="text-green underline-offset-4 hover:underline" href={links.tripadvisor} target="_blank" rel="noopener">Tripadvisor</a>}
            </div>
          )}
        </div>
      )}
      <div className="mt-8 flex items-center gap-2 text-gold">
        <Fleur className="h-4 w-4" />
      </div>
      <button type="button" onClick={onAnother} className="mt-4 text-sm text-muted underline underline-offset-4">
        {t.shareAnother}
      </button>
    </section>
  );
}

function GoogleG() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path fill="#4285F4" d="M22.5 12.3c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.5c2.1-1.9 3.3-4.7 3.3-8Z" />
      <path fill="#34A853" d="M12 23c3 0 5.4-1 7.2-2.7l-3.5-2.7c-1 .7-2.2 1-3.7 1-2.9 0-5.3-1.9-6.2-4.5H2.2v2.8A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.8 14.1a6.6 6.6 0 0 1 0-4.2V7.1H2.2a11 11 0 0 0 0 9.8l3.6-2.8Z" />
      <path fill="#EA4335" d="M12 5.4c1.6 0 3 .6 4.2 1.6l3.1-3.1A11 11 0 0 0 2.2 7.1l3.6 2.8C6.7 7.3 9.1 5.4 12 5.4Z" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" />
    </svg>
  );
}
