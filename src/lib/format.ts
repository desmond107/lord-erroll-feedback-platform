import { RESTAURANT } from "./config";

const TZ = RESTAURANT.timezone;

export function fmtDateTime(d: Date | string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ, day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(new Date(d));
}

export function fmtDate(d: Date | string, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: TZ, ...opts }).format(new Date(d));
}

// Visit dates are stored as calendar dates (UTC midnight), so format them in UTC.
export function fmtVisitDate(d: Date | string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short", year: "numeric" }).format(new Date(d));
}

export function fmtRelative(d: Date | string, now = new Date()) {
  const s = Math.round((now.getTime() - new Date(d).getTime()) / 1000);
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hr ago`;
  const days = Math.round(h / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return fmtDate(d);
}

// YYYY-MM-DD for "today" in Nairobi.
export function nairobiDateKey(d: Date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

// Start of the given Nairobi calendar day, as a UTC instant (Nairobi is UTC+3 year-round).
export function nairobiDayStart(key: string) {
  return new Date(`${key}T00:00:00+03:00`);
}

export function avg(nums: (number | null | undefined)[]) {
  const v = nums.filter((n): n is number => typeof n === "number");
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

export function npsScore(scores: (number | null | undefined)[]) {
  const v = scores.filter((n): n is number => typeof n === "number");
  if (!v.length) return null;
  const promoters = v.filter((n) => n >= 9).length;
  const detractors = v.filter((n) => n <= 6).length;
  return Math.round(((promoters - detractors) / v.length) * 100);
}

export const fixed1 = (n: number | null) => (n == null ? "—" : n.toFixed(1));
