"use client";

import { useRef, useState } from "react";

type Point = { label: string; value: number | null; detail?: string };

function Tooltip({ x, y, value, label, detail }: { x: number; y: number; value: string; label: string; detail?: string }) {
  return (
    <div
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md border border-line bg-surface px-2.5 py-1.5 text-xs whitespace-nowrap shadow-soft"
      style={{ left: x, top: y - 8 }}
      role="status"
    >
      <div className="text-sm font-semibold text-ink tabular-nums">{value}</div>
      <div className="text-muted">{label}</div>
      {detail && <div className="text-muted">{detail}</div>}
    </div>
  );
}

// Bar with 4px rounded data-end, square at the baseline.
function roundedTop(x: number, y: number, w: number, h: number) {
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`;
}

const nice = (max: number) => {
  if (max <= 5) return 5;
  const p = Math.pow(10, Math.floor(Math.log10(max)));
  return Math.ceil(max / p) * p;
};

/** Single-series columns (e.g. responses per day). */
export function ColumnChart({ data, height = 180, unit = "responses", ariaLabel }: { data: Point[]; height?: number; unit?: string; ariaLabel: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const max = nice(Math.max(1, ...data.map((d) => d.value ?? 0)));
  const W = 600, H = height, padL = 28, padB = 22, padT = 8;
  const cw = (W - padL) / data.length;
  const bw = Math.max(2, Math.min(28, cw - 2)); // 2px surface gap between bars
  const step = Math.ceil(data.length / 8);
  const y = (v: number) => padT + (H - padT - padB) * (1 - v / max);
  const ticks = [0, max / 2, max];

  return (
    <div ref={wrap} className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={ariaLabel} onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={W} y1={y(t)} y2={y(t)} stroke="var(--chart-grid)" strokeWidth="1" />
            <text x={padL - 6} y={y(t) + 3} textAnchor="end" fontSize="10" fill="var(--muted)">{Math.round(t)}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const v = d.value ?? 0;
          const x = padL + i * cw + (cw - bw) / 2;
          const top = y(v);
          return (
            <g key={i}>
              {v > 0 && (
                <path
                  d={roundedTop(x, top, bw, H - padB - top)}
                  fill="var(--chart-mag)"
                  opacity={hover == null || hover === i ? 1 : 0.55}
                />
              )}
              {/* Hit target spans the whole column, not just the painted bar. */}
              <rect
                x={padL + i * cw}
                y={padT}
                width={cw}
                height={H - padT - padB}
                fill="transparent"
                tabIndex={0}
                aria-label={`${d.label}: ${v} ${unit}`}
                onMouseEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
              />
              {i % step === 0 && (
                <text x={padL + i * cw + cw / 2} y={H - 6} textAnchor="middle" fontSize="10" fill="var(--muted)">{d.label}</text>
              )}
            </g>
          );
        })}
      </svg>
      {hover != null && wrap.current && (
        <Tooltip
          x={((padL + hover * cw + cw / 2) / W) * wrap.current.clientWidth}
          y={(y(data[hover].value ?? 0) / H) * wrap.current.clientWidth * (H / W)}
          value={`${data[hover].value ?? 0} ${unit}`}
          label={data[hover].label}
          detail={data[hover].detail}
        />
      )}
    </div>
  );
}

/** Single-series line with a crosshair (e.g. average rating over time). */
export function LineChart({ data, min = 1, max = 5, height = 180, ariaLabel }: {
  data: Point[]; min?: number; max?: number; height?: number; ariaLabel: string;
}) {
  const format = (v: number) => v.toFixed(2);
  const [hover, setHover] = useState<number | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const W = 600, H = height, padL = 28, padB = 22, padT = 10;
  const cw = (W - padL) / Math.max(1, data.length - 1);
  const xAt = (i: number) => padL + (data.length === 1 ? (W - padL) / 2 : i * cw);
  const yAt = (v: number) => padT + (H - padT - padB) * (1 - (v - min) / (max - min));
  const step = Math.ceil(data.length / 8);
  const segments: string[] = [];
  let cur = "";
  data.forEach((d, i) => {
    if (d.value == null) {
      if (cur) segments.push(cur);
      cur = "";
    } else cur += `${cur ? "L" : "M"}${xAt(i)},${yAt(d.value)} `;
  });
  if (cur) segments.push(cur);

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const sx = ((e.clientX - r.left) / r.width) * W;
    setHover(Math.max(0, Math.min(data.length - 1, Math.round((sx - padL) / cw))));
  };
  const hv = hover != null ? data[hover] : null;

  return (
    <div ref={wrap} className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full touch-none"
        role="img"
        aria-label={ariaLabel}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") setHover((h) => Math.min(data.length - 1, (h ?? -1) + 1));
          if (e.key === "ArrowLeft") setHover((h) => Math.max(0, (h ?? data.length) - 1));
        }}
        onBlur={() => setHover(null)}
      >
        {[min, (min + max) / 2, max].map((t) => (
          <g key={t}>
            <line x1={padL} x2={W} y1={yAt(t)} y2={yAt(t)} stroke="var(--chart-grid)" strokeWidth="1" />
            <text x={padL - 6} y={yAt(t) + 3} textAnchor="end" fontSize="10" fill="var(--muted)">{t}</text>
          </g>
        ))}
        {hover != null && <line x1={xAt(hover)} x2={xAt(hover)} y1={padT} y2={H - padB} stroke="var(--muted)" strokeWidth="1" strokeDasharray="3 3" />}
        {segments.map((d, i) => (
          <path key={i} d={d} fill="none" stroke="var(--chart-mag)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        ))}
        {data.map((d, i) =>
          d.value != null && (data.length <= 16 || hover === i) ? (
            <circle key={i} cx={xAt(i)} cy={yAt(d.value)} r={hover === i ? 5 : 4} fill="var(--chart-mag)" stroke="var(--surface)" strokeWidth="2" />
          ) : null,
        )}
        {data.map((d, i) =>
          i % step === 0 ? <text key={i} x={xAt(i)} y={H - 6} textAnchor="middle" fontSize="10" fill="var(--muted)">{d.label}</text> : null,
        )}
      </svg>
      {hv && wrap.current && (
        <Tooltip
          x={(xAt(hover!) / W) * wrap.current.clientWidth}
          y={((hv.value != null ? yAt(hv.value) : padT) / H) * wrap.current.clientWidth * (H / W)}
          value={hv.value != null ? format(hv.value) : "No responses"}
          label={hv.label}
          detail={hv.detail}
        />
      )}
    </div>
  );
}

/** Horizontal bars with direct value labels — readable without hovering. */
const FORMATS = { avg: (v: number) => v.toFixed(2), count: (v: number) => String(Math.round(v)) };

export function BarList({ rows, max, kind = "avg", tone = "mag" }: {
  rows: { label: string; value: number | null; sub?: string; href?: string }[];
  max: number;
  kind?: keyof typeof FORMATS;
  tone?: "mag" | "gold";
}) {
  const format = FORMATS[kind];
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.label} title={r.value != null ? `${r.label}: ${format(r.value)}${r.sub ? ` · ${r.sub}` : ""}` : `${r.label}: no data`}>
          <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
            <span className="truncate">
              {r.href ? <a href={r.href} className="hover:underline">{r.label}</a> : r.label}
              {r.sub && <span className="ml-1.5 text-xs text-muted">{r.sub}</span>}
            </span>
            <span className="font-semibold tabular-nums">{r.value != null ? format(r.value) : "—"}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-chart-grid">
            <div
              className={`h-full rounded-full transition-[width] duration-700 ${tone === "gold" ? "bg-gold" : "bg-chart-mag"}`}
              style={{ width: `${r.value != null && max ? Math.max(1.5, (r.value / max) * 100) : 0}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Positive / neutral / negative split, always labelled with counts. */
export function SentimentStack({ positive, neutral, negative, compact }: { positive: number; neutral: number; negative: number; compact?: boolean }) {
  const total = positive + neutral + negative || 1;
  const segs = [
    { k: "Positive", v: positive, c: "bg-chart-pos" },
    { k: "Neutral", v: neutral, c: "bg-chart-neu" },
    { k: "Negative", v: negative, c: "bg-chart-neg" },
  ];
  return (
    <div>
      <div className={`flex gap-[2px] overflow-hidden rounded-full ${compact ? "h-2" : "h-3"}`} role="img" aria-label={`Positive ${positive}, neutral ${neutral}, negative ${negative}`}>
        {segs.filter((s) => s.v > 0).map((s) => (
          <div key={s.k} className={`${s.c} h-full first:rounded-l-full last:rounded-r-full`} style={{ width: `${(s.v / total) * 100}%` }} title={`${s.k}: ${s.v}`} />
        ))}
      </div>
      {!compact && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          {segs.map((s) => (
            <span key={s.k} className="inline-flex items-center gap-1.5">
              <span className={`h-2.5 w-2.5 rounded-sm ${s.c}`} aria-hidden />
              {s.k} <b className="text-ink tabular-nums">{s.v}</b> ({Math.round((s.v / total) * 100)}%)
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
