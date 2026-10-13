import type { FeedbackStatus } from "@prisma/client";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-serif text-[2.1rem] leading-tight font-semibold">{title}</h1>
        {subtitle && <div className="mt-1 text-sm text-muted">{subtitle}</div>}
      </div>
      {actions && <div className="no-print flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Crowns({ value, size = "sm" }: { value: number | null | undefined; size?: "sm" | "md" }) {
  const n = value ?? 0;
  const cls = size === "md" ? "h-5 w-6" : "h-3.5 w-4";
  return (
    <span className="inline-flex gap-0.5" role="img" aria-label={value ? `${value} out of 5` : "Not rated"}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} viewBox="0 0 48 40" className={`${cls} ${i <= n ? "text-gold" : "text-line"}`} aria-hidden>
          <path d="M5 14 14 22 24 6l10 16 9-8-4 20H9L5 14Z M9 34h30v4H9z" fill="currentColor" />
        </svg>
      ))}
    </span>
  );
}

export function RatingBadge({ value }: { value: number }) {
  const urgent = value <= 3;
  return (
    <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-serif text-lg font-semibold ${urgent ? "bg-crimson text-white" : value === 5 ? "bg-green text-on-accent" : "bg-gold-soft text-gold-ink"}`}>
      {value}
    </span>
  );
}

const STATUS: Record<FeedbackStatus, { label: string; cls: string }> = {
  NEW: { label: "New", cls: "bg-gold-soft text-gold-ink" },
  IN_PROGRESS: { label: "In progress", cls: "bg-green-soft text-green" },
  RESOLVED: { label: "Resolved", cls: "bg-line/60 text-muted" },
};
export const statusLabel = (s: FeedbackStatus) => STATUS[s].label;

export function StatusPill({ status }: { status: FeedbackStatus }) {
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS[status].cls}`}>{STATUS[status].label}</span>;
}

export function UrgentTag() {
  return <span className="inline-flex items-center gap-1 rounded-full bg-crimson px-2 py-0.5 text-[0.68rem] font-bold tracking-wider text-white uppercase">Urgent</span>;
}

export function SentimentTag({ s }: { s: "POSITIVE" | "NEUTRAL" | "NEGATIVE" }) {
  const m = { POSITIVE: ["Positive", "text-green border-green/40"], NEUTRAL: ["Neutral", "text-muted border-line"], NEGATIVE: ["Negative", "text-crimson border-crimson/40"] }[s];
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${m[1]}`}>{m[0]}</span>;
}

export function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="card flex flex-col items-center px-6 py-14 text-center">
      <div className="font-serif text-2xl font-semibold">{title}</div>
      {children && <div className="mt-2 max-w-md text-sm text-muted">{children}</div>}
    </div>
  );
}
