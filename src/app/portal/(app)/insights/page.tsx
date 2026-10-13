import Link from "next/link";
import { can, requireUser } from "@/lib/auth";
import { RANGES, getInsights, getQrStats, resolveRange } from "@/lib/stats";
import { RATING_LABELS } from "@/lib/config";
import { fixed1 } from "@/lib/format";
import { PageHeader } from "@/components/portal/ui";
import { BarList, ColumnChart, LineChart, SentimentStack } from "@/components/portal/Charts";

export const metadata = { title: "Insights" };

type Bucket = "day" | "week" | "month";

export default async function Insights({ searchParams }: { searchParams: Promise<{ range?: string; by?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const range = resolveRange(sp.range);
  const by = (["day", "week", "month"] as const).includes(sp.by as Bucket) ? (sp.by as Bucket) : undefined;
  const [ins, qr] = await Promise.all([getInsights(range, by), getQrStats(range)]);
  const t = ins.totals;
  const href = (o: { range?: string; by?: string }) => {
    const p = new URLSearchParams({ range: o.range ?? range.key, ...(o.by ?? by ? { by: o.by ?? by! } : {}) });
    return `/portal/insights?${p}`;
  };

  return (
    <>
      <PageHeader
        title="Insights"
        subtitle={`${range.label} · ${t.count} response${t.count === 1 ? "" : "s"}`}
        actions={
          <>
            <div className="flex rounded-full border border-line bg-surface p-1 text-sm">
              {RANGES.map((r) => (
                <Link key={r.key} href={href({ range: r.key })} className={`rounded-full px-3 py-1 ${r.key === range.key ? "bg-green text-on-accent" : "text-muted hover:text-ink"}`}>
                  {r.key === "365d" ? "12m" : r.key}
                </Link>
              ))}
            </div>
            {can(user, "export") && <a className="btn btn-ghost btn-sm" href={`/api/portal/report?range=${range.key}`}>⤓ PDF report</a>}
          </>
        }
      />

      {/* Headline numbers */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi label="Average rating" value={fixed1(t.avgOverall)} suffix="/5" delta={t.avgOverall != null && t.prevAvg != null ? t.avgOverall - t.prevAvg : null} digits={2} />
        <Kpi label="Recommendation score" value={t.nps == null ? "—" : String(t.nps)} hint="NPS: % promoters − % detractors" delta={t.nps != null && t.prevNps != null ? t.nps - t.prevNps : null} digits={0} />
        <Kpi label="Responses" value={String(t.count)} delta={t.count - t.prevCount} digits={0} />
        <Kpi label="Urgent (1–3)" value={String(t.urgent)} tone={t.openUrgent ? "bad" : undefined} hint={t.openUrgent ? `${t.openUrgent} still open` : "All handled"} href="/portal?rating=urgent" />
        <Kpi label="Time to resolve" value={t.avgResolutionHours == null ? "—" : t.avgResolutionHours < 48 ? `${t.avgResolutionHours.toFixed(1)}h` : `${(t.avgResolutionHours / 24).toFixed(1)}d`} hint={`${t.open} open overall`} />
      </div>

      {/* Trends */}
      <section className="card mt-5 p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-serif text-2xl font-semibold">Trends</h2>
          <div className="flex rounded-full border border-line bg-bg p-1 text-xs">
            {(["day", "week", "month"] as const).map((b) => (
              <Link key={b} href={href({ by: b })} className={`rounded-full px-3 py-1 capitalize ${ins.bucket === b ? "bg-ink text-bg" : "text-muted"}`}>
                By {b}
              </Link>
            ))}
          </div>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <h3 className="mb-2 text-sm font-medium text-muted">Responses</h3>
            <ColumnChart ariaLabel="Responses over time" data={ins.trend.map((x) => ({ label: x.label, value: x.count, detail: x.avg ? `avg ${x.avg.toFixed(2)}` : undefined }))} />
          </div>
          <div>
            <h3 className="mb-2 text-sm font-medium text-muted">Average overall rating</h3>
            <LineChart ariaLabel="Average rating over time" data={ins.trend.map((x) => ({ label: x.label, value: x.avg, detail: `${x.count} responses` }))} />
          </div>
        </div>
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer text-muted">View as table</summary>
          <div className="mt-2 max-h-72 overflow-auto">
            <table className="w-full text-left tabular-nums">
              <thead className="text-xs text-muted uppercase"><tr><th className="py-1">Period</th><th>Responses</th><th>Avg rating</th><th>NPS</th></tr></thead>
              <tbody>
                {ins.trend.map((x) => (
                  <tr key={x.key} className="border-t border-line"><td className="py-1">{x.label}</td><td>{x.count}</td><td>{x.avg?.toFixed(2) ?? "—"}</td><td>{x.nps ?? "—"}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <section className="card p-5">
          <h2 className="mb-4 font-serif text-xl font-semibold">Rating distribution</h2>
          <BarList
            rows={[5, 4, 3, 2, 1].map((n) => ({ label: `${n} · ${RATING_LABELS.en[n]}`, value: t.distribution[n - 1], href: `/portal?rating=${n}` }))}
            max={Math.max(1, ...t.distribution)}
            kind="count"
          />
          <div className="mt-5 border-t border-line pt-4">
            <h3 className="mb-2 text-sm font-medium text-muted">Would recommend</h3>
            <div className="grid grid-cols-3 gap-2 text-center text-sm">
              <div><div className="font-serif text-2xl font-semibold">{t.promoters}</div><div className="text-xs text-muted">Promoters 9–10</div></div>
              <div><div className="font-serif text-2xl font-semibold">{t.passives}</div><div className="text-xs text-muted">Passives 7–8</div></div>
              <div><div className="font-serif text-2xl font-semibold">{t.detractors}</div><div className="text-xs text-muted">Detractors 0–6</div></div>
            </div>
          </div>
        </section>
        <section className="card p-5">
          <h2 className="mb-4 font-serif text-xl font-semibold">By category</h2>
          <BarList rows={ins.byCategory.map((c) => ({ label: c.label, value: c.avg, sub: `${c.count} rated` }))} max={5} tone="gold" />
        </section>
        <section className="card p-5">
          <h2 className="mb-4 font-serif text-xl font-semibold">By occasion</h2>
          {ins.byOccasion.some((o) => o.count) ? (
            <BarList rows={ins.byOccasion.filter((o) => o.count).map((o) => ({ label: o.label, value: o.avg, sub: `${o.count}`, href: `/portal?occasion=${o.key}` }))} max={5} />
          ) : (
            <p className="text-sm text-muted">No occasions recorded yet.</p>
          )}
        </section>
      </div>

      <section className="mt-5">
        <h2 className="mb-3 font-serif text-2xl font-semibold">By seating area</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {ins.bySection.map((s) => (
            <Link key={s.slug} href={`/portal?section=${s.slug}`} className="card block p-5 transition-colors hover:border-gold">
              <div className="flex items-baseline justify-between">
                <h3 className="font-serif text-xl font-semibold">{s.label}</h3>
                {s.urgent > 0 && <span className="rounded-full bg-crimson-soft px-2 py-0.5 text-xs text-crimson">{s.urgent} urgent</span>}
              </div>
              <div className="mt-2 flex items-end gap-4">
                <div><div className="font-serif text-3xl font-semibold">{fixed1(s.avg)}</div><div className="text-xs text-muted">avg rating</div></div>
                <div><div className="font-serif text-3xl font-semibold">{s.nps ?? "—"}</div><div className="text-xs text-muted">NPS</div></div>
                <div><div className="font-serif text-3xl font-semibold">{s.count}</div><div className="text-xs text-muted">responses</div></div>
              </div>
              <div className="mt-4 space-y-1.5">
                {(["food", "service", "ambience", "drinks"] as const).map((k) => (
                  <div key={k} className="flex items-center gap-2 text-xs">
                    <span className="w-16 text-muted capitalize">{k}</span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-chart-grid">
                      <div className="h-full rounded-full bg-chart-mag" style={{ width: `${((s.categories[k] ?? 0) / 5) * 100}%` }} />
                    </div>
                    <span className="w-7 text-right font-semibold tabular-nums">{fixed1(s.categories[k])}</span>
                  </div>
                ))}
              </div>
            </Link>
          ))}
        </div>
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-1 font-serif text-xl font-semibold">Staff recognition</h2>
          <p className="mb-4 text-sm text-muted">Team members guests named as making their visit special.</p>
          {ins.staff.length ? (
            <ol className="space-y-3">
              {ins.staff.slice(0, 10).map((s, i) => (
                <li key={s.name} className="flex items-start gap-3">
                  <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full font-serif text-lg font-semibold ${i === 0 ? "bg-gold text-[#1f2421]" : i < 3 ? "bg-gold-soft text-gold-ink" : "bg-bg text-muted"}`}>{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <Link href={`/portal?staff=${encodeURIComponent(s.name)}`} className="font-semibold hover:underline">{s.name}</Link>
                      <span className="text-sm tabular-nums"><b>{s.count}</b> <span className="text-muted">mention{s.count === 1 ? "" : "s"} · avg {fixed1(s.avg)}</span></span>
                    </div>
                    {s.quote && <p className="mt-0.5 line-clamp-2 font-serif text-[0.98rem] text-muted italic">“{s.quote}”</p>}
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-muted">No staff mentioned in this period.</p>
          )}
        </section>

        <section className="card p-5">
          <h2 className="mb-1 font-serif text-xl font-semibold">Sentiment and themes</h2>
          <p className="mb-4 text-sm text-muted">What guests write about, and how they feel about it.</p>
          <SentimentStack positive={ins.sentiment.POSITIVE} neutral={ins.sentiment.NEUTRAL} negative={ins.sentiment.NEGATIVE} />
          <ul className="mt-5 space-y-3">
            {ins.themes.slice(0, 8).map((th) => (
              <li key={th.key}>
                <div className="mb-1 flex items-baseline justify-between text-sm">
                  <span>{th.label}</span>
                  <span className="text-xs text-muted tabular-nums"><b className="text-ink">{th.total}</b> · {th.positive} positive · {th.negative} negative</span>
                </div>
                <SentimentStack compact positive={th.positive} neutral={th.neutral} negative={th.negative} />
              </li>
            ))}
            {!ins.themes.length && <li className="text-sm text-muted">No written comments in this period.</li>}
          </ul>
        </section>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <section className="card p-5">
          <h2 className="mb-1 font-serif text-xl font-semibold">Word cloud</h2>
          <p className="mb-4 text-sm text-muted">Most frequent words in comments. Tap a word to see those comments.</p>
          <WordCloud words={ins.words} />
        </section>
        <section className="card p-5">
          <h2 className="mb-3 font-serif text-xl font-semibold">Most selected</h2>
          <h3 className="mb-2 text-xs tracking-wide text-muted uppercase">What stood out</h3>
          <div className="mb-4 flex flex-wrap gap-1.5">
            {ins.highlights.slice(0, 8).map((h) => <span key={h.key} className="rounded-full border border-green/40 bg-green-soft px-2.5 py-1 text-xs text-green">{h.label} <b>{h.count}</b></span>)}
            {!ins.highlights.length && <span className="text-sm text-muted">—</span>}
          </div>
          <h3 className="mb-2 text-xs tracking-wide text-muted uppercase">Could be better</h3>
          <div className="flex flex-wrap gap-1.5">
            {ins.improvements.slice(0, 8).map((h) => <span key={h.key} className="rounded-full border border-crimson/40 bg-crimson-soft px-2.5 py-1 text-xs text-crimson">{h.label} <b>{h.count}</b></span>)}
            {!ins.improvements.length && <span className="text-sm text-muted">—</span>}
          </div>
        </section>
      </div>

      <section className="card mt-5 p-5">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-serif text-xl font-semibold">QR code performance</h2>
          <Link href={`/portal/qr?range=${range.key}`} className="text-sm text-green hover:underline">Per-table detail →</Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-5">
          <div className="sm:border-r sm:border-line sm:pr-4">
            <div className="font-serif text-4xl font-semibold">{qr.rate == null ? "—" : `${Math.round(qr.rate * 100)}%`}</div>
            <div className="text-xs text-muted">completion · {qr.totalSubs} of {qr.totalScans} scans</div>
          </div>
          {qr.bySection.map((s) => (
            <div key={s.slug}>
              <div className="text-sm font-medium">{s.label}</div>
              <div className="font-serif text-2xl font-semibold">{s.rate == null ? "—" : `${Math.round(s.rate * 100)}%`}</div>
              <div className="text-xs text-muted">{s.submissions} of {s.scans} scans</div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function Kpi({ label, value, suffix, delta, digits = 1, hint, tone, href }: { label: string; value: string; suffix?: string; delta?: number | null; digits?: number; hint?: string; tone?: "bad"; href?: string }) {
  const body = (
    <>
      <div className="text-xs tracking-wide text-muted uppercase">{label}</div>
      <div className={`mt-1 font-serif text-4xl font-semibold ${tone === "bad" ? "text-crimson" : ""}`}>
        {value}
        {suffix && value !== "—" && <span className="text-lg text-muted">{suffix}</span>}
      </div>
      {delta != null && Number.isFinite(delta) ? (
        <div className={`text-xs ${delta > 0 ? "text-green" : delta < 0 ? "text-crimson" : "text-muted"}`}>
          {delta > 0 ? "▲" : delta < 0 ? "▼" : "■"} {delta > 0 ? "+" : ""}{delta.toFixed(digits)} vs previous
        </div>
      ) : (
        hint && <div className="text-xs text-muted">{hint}</div>
      )}
    </>
  );
  return href ? <Link href={href} className="card block p-4 hover:border-gold">{body}</Link> : <div className="card p-4">{body}</div>;
}

function WordCloud({ words }: { words: { word: string; count: number; tone: string }[] }) {
  if (!words.length) return <p className="text-sm text-muted">Not enough comments yet.</p>;
  const max = words[0].count, min = words[words.length - 1].count;
  const shuffled = [...words].sort((a, b) => a.word.localeCompare(b.word));
  return (
    <>
      <div className="flex flex-wrap items-baseline justify-center gap-x-3 gap-y-1 py-2">
        {shuffled.map((w) => {
          const k = max === min ? 0.5 : (w.count - min) / (max - min);
          return (
            <Link
              key={w.word}
              href={`/portal?q=${encodeURIComponent(w.word)}`}
              title={`${w.word}: ${w.count} comment${w.count === 1 ? "" : "s"}`}
              className={`font-serif leading-tight transition-opacity hover:opacity-70 ${w.tone === "positive" ? "text-chart-pos" : w.tone === "negative" ? "text-chart-neg" : "text-ink"}`}
              style={{ fontSize: `${0.9 + k * 1.6}rem`, fontWeight: k > 0.5 ? 700 : 500 }}
            >
              {w.word}
            </Link>
          );
        })}
      </div>
      <div className="mt-3 flex justify-center gap-4 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-chart-pos" />Positive word</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-ink" />Neutral</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-chart-neg" />Negative word</span>
      </div>
    </>
  );
}
