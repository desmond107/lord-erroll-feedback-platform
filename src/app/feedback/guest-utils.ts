"use client";

import type { Lang } from "@/lib/i18n";

export type Draft = {
  v: 1;
  clientId: string;
  startedAt: number;
  savedAt: number;
  step: number;
  lang: Lang;
  section: string;
  table: string;
  occasion: string | null;
  visitDate: string;
  overall: number | null;
  ratings: Record<string, number | null>;
  highlights: string[];
  improvements: string[];
  staffName: string;
  staffMessage: string;
  suggestion: string;
  nps: number | null;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  followUp: boolean;
};

const DRAFT_KEY = "le-feedback-draft-v1";
const LAST_KEY = "le-feedback-last-v1";
const OUTBOX_KEY = "le-feedback-outbox-v1";
const VISITOR_KEY = "le-visitor-id";
const LANG_KEY = "le-lang";

const DRAFT_TTL = 12 * 3600e3;
export const COOLDOWN_MS = 3 * 3600e3;

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
function write(key: string, value: unknown) {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function uuid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  // RFC 4122 v4 fallback for older browsers.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function todayKey() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Nairobi", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export function loadDraft(): Draft | null {
  const d = read<Draft>(DRAFT_KEY);
  if (!d || d.v !== 1 || Date.now() - d.savedAt > DRAFT_TTL) return null;
  return d;
}
export const saveDraft = (d: Draft) => write(DRAFT_KEY, { ...d, savedAt: Date.now() });
export const clearDraft = () => write(DRAFT_KEY, null);

export function lastSubmission() {
  return read<{ at: number; section: string; table: string }>(LAST_KEY);
}
export const markSubmitted = (section: string, table: string) => write(LAST_KEY, { at: Date.now(), section, table });

export function preferredLang(): Lang {
  const saved = read<Lang>(LANG_KEY);
  if (saved === "en" || saved === "sw") return saved;
  return typeof navigator !== "undefined" && navigator.language?.toLowerCase().startsWith("sw") ? "sw" : "en";
}
export const saveLang = (l: Lang) => write(LANG_KEY, l);

export function visitorId() {
  let id = read<string>(VISITOR_KEY);
  if (!id) {
    id = uuid();
    write(VISITOR_KEY, id);
  }
  return id;
}

export function recordScan(section: string, table: string) {
  try {
    const flag = `le-scan-${section}-${table}-${todayKey()}`;
    if (sessionStorage.getItem(flag)) return;
    sessionStorage.setItem(flag, "1");
    const body = JSON.stringify({ section, table: table || null, visitorId: visitorId() });
    if (navigator.sendBeacon) navigator.sendBeacon("/api/scan", new Blob([body], { type: "application/json" }));
    else fetch("/api/scan", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true }).catch(() => {});
  } catch {
    /* scan counts are best-effort */
  }
}

// ─── Photos ─────────────────────────────────────────────────────────────

export type Photo = { id: string; blob: Blob; url: string };

/** Downscale to keep uploads light on mobile data. */
export async function compressImage(file: File, maxEdge = 1600, quality = 0.8): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const scale = Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", quality));
    return blob && blob.size < file.size ? blob : file;
  } finally {
    URL.revokeObjectURL(url);
  }
}

const blobToDataUrl = (b: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(b);
  });

async function dataUrlToBlob(u: string) {
  return (await fetch(u)).blob();
}

// ─── Submission with retries and an offline outbox ─────────────────────

export type SubmitOutcome =
  | { kind: "ok"; ref: string | null }
  | { kind: "queued" }
  | { kind: "error"; code: string };

type Outbox = { payload: Record<string, unknown>; photos: string[]; at: number };

async function post(payload: Record<string, unknown>, photos: Blob[]) {
  const fd = new FormData();
  fd.set("payload", JSON.stringify(payload));
  photos.forEach((p, i) => fd.append("photos", p, `photo-${i + 1}.jpg`));
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30000);
  try {
    const res = await fetch("/api/feedback", { method: "POST", body: fd, signal: ctrl.signal });
    const json = await res.json().catch(() => ({}));
    return { status: res.status, json };
  } finally {
    clearTimeout(timer);
  }
}

export async function submitFeedback(payload: Record<string, unknown>, photos: Blob[]): Promise<SubmitOutcome> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const { status, json } = await post(payload, photos);
      if (status === 200) return { kind: "ok", ref: json.ref ?? null };
      if (status < 500) return { kind: "error", code: json.error || "invalid" };
    } catch {
      if (typeof navigator !== "undefined" && navigator.onLine === false) break;
    }
    await new Promise((r) => setTimeout(r, 1200 * (attempt + 1)));
  }
  // Keep it on the phone and try again later. clientId makes the retry idempotent.
  const photoUrls = await Promise.all(photos.map(blobToDataUrl)).catch(() => []);
  if (!write(OUTBOX_KEY, { payload, photos: photoUrls, at: Date.now() } satisfies Outbox)) {
    write(OUTBOX_KEY, { payload, photos: [], at: Date.now() } satisfies Outbox);
  }
  return { kind: "queued" };
}

export async function flushOutbox() {
  const box = read<Outbox>(OUTBOX_KEY);
  if (!box) return;
  if (Date.now() - box.at > 7 * 86400e3) return write(OUTBOX_KEY, null);
  try {
    const blobs = await Promise.all(box.photos.map(dataUrlToBlob));
    const { status } = await post(box.payload, blobs);
    // 4xx means the server will never accept it; drop it rather than retry forever.
    if (status < 500) write(OUTBOX_KEY, null);
  } catch {
    /* still offline */
  }
}
