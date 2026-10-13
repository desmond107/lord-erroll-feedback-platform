import Link from "next/link";
import { can, requireUser } from "@/lib/auth";
import { getTables } from "@/lib/tables";
import { getQrStats, RANGES, resolveRange } from "@/lib/stats";
import { feedbackUrl } from "@/lib/config";
import { qrSvg } from "@/lib/qr";
import { PageHeader } from "@/components/portal/ui";
import { AddTables, RemoveTable } from "./TableEditor";

export const metadata = { title: "QR codes" };

export default async function QrPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const user = await requireUser();
  const range = resolveRange((await searchParams).range ?? "30d");
  const [sections, stats] = await Promise.all([getTables(), getQrStats(range)]);
  const statFor = (section: string, table: string) => stats.tables.find((t) => t.section === section && t.table === table);
  const svgs = new Map<string, string>();
  await Promise.all(
    sections.flatMap((s) => [undefined, ...s.tables].map(async (t) => svgs.set(`${s.slug}|${t ?? ""}`, await qrSvg(s.slug, t)))),
  );
  const editable = can(user, "tables");

  return (
    <>
      <PageHeader
        title="QR codes"
        subtitle="One code per table and per seating area. Scans are counted so you can see how many guests go on to leave feedback."
        actions={
          <>
            <Link href="/portal/qr-print?size=table" className="btn btn-green btn-sm" target="_blank">🖨 Print table cards</Link>
            <Link href="/portal/qr-print?size=bill" className="btn btn-ghost btn-sm" target="_blank">Bill-folder cards</Link>
            <a href="/api/portal/qr/zip" className="btn btn-ghost btn-sm">⤓ Download all (ZIP)</a>
          </>
        }
      />

      <div className="card mb-5 flex flex-wrap items-center gap-x-8 gap-y-3 p-5">
        <div>
          <div className="text-xs tracking-wide text-muted uppercase">Completion · {range.label.toLowerCase()}</div>
          <div className="font-serif text-4xl font-semibold">{stats.rate == null ? "—" : `${Math.round(stats.rate * 100)}%`}</div>
          <div className="text-xs text-muted">{stats.totalSubs} submissions from {stats.totalScans} scans</div>
        </div>
        <div className="ml-auto flex rounded-full border border-line bg-bg p-1 text-sm">
          {RANGES.map((r) => (
            <Link key={r.key} href={`/portal/qr?range=${r.key}`} className={`rounded-full px-3 py-1 ${r.key === range.key ? "bg-green text-on-accent" : "text-muted"}`}>
              {r.key === "365d" ? "12m" : r.key}
            </Link>
          ))}
        </div>
        <p className="w-full text-xs text-muted">
          A scan is one phone opening a table&apos;s link on a given day. PDF versions: <a className="text-green underline" href="/api/portal/qr/cards?size=table" target="_blank">A6 table cards</a> · <a className="text-green underline" href="/api/portal/qr/cards?size=bill" target="_blank">bill-folder cards</a>.
        </p>
      </div>

      <div className="space-y-6">
        {sections.map((s) => {
          const sec = stats.bySection.find((x) => x.slug === s.slug)!;
          const secOnly = statFor(s.slug, "");
          return (
            <section key={s.slug} className="card p-5">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="font-serif text-2xl font-semibold">{s.en}</h2>
                  <p className="text-sm text-muted">
                    {s.tables.length} tables · {sec.scans} scans · {sec.submissions} submissions · {sec.rate == null ? "—" : `${Math.round(sec.rate * 100)}% completion`}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-16 w-16 rounded bg-white p-1" dangerouslySetInnerHTML={{ __html: svgs.get(`${s.slug}|`)! }} />
                  <div className="text-xs">
                    <div className="font-medium">Section code</div>
                    <div className="text-muted">{secOnly?.scans ?? 0} scans</div>
                    <a className="text-green underline" href={`/api/portal/qr/code?section=${s.slug}`}>PNG</a> · <a className="text-green underline" href={`/api/portal/qr/code?section=${s.slug}&format=svg`}>SVG</a>
                  </div>
                </div>
              </div>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                {s.tables.map((t) => {
                  const st = statFor(s.slug, t);
                  const rate = st?.scans ? Math.min(1, st.submissions / st.scans) : null;
                  return (
                    <li key={t} className="rounded-xl border border-line bg-bg p-3 text-center">
                      <div className="mx-auto mb-2 aspect-square w-full max-w-28 rounded bg-white p-1.5" dangerouslySetInnerHTML={{ __html: svgs.get(`${s.slug}|${t}`)! }} />
                      <div className="font-serif text-lg font-semibold">Table {t}</div>
                      <div className="text-xs text-muted tabular-nums">
                        {st?.scans ?? 0} scans · {st?.submissions ?? 0} sent
                        {rate != null && <> · <b className="text-ink">{Math.round(rate * 100)}%</b></>}
                      </div>
                      <div className="mt-1.5 flex justify-center gap-2 text-xs">
                        <a className="text-green underline" href={`/api/portal/qr/code?section=${s.slug}&table=${t}`}>PNG</a>
                        <a className="text-green underline" href={`/api/portal/qr/code?section=${s.slug}&table=${t}&format=svg`}>SVG</a>
                        <a className="text-green underline" href={feedbackUrl(s.slug, t)} target="_blank" rel="noopener">Open</a>
                      </div>
                      {editable && <div className="mt-1"><RemoveTable section={s.slug} number={t} /></div>}
                    </li>
                  );
                })}
              </ul>
              {editable && <div className="mt-4 border-t border-line pt-4"><AddTables section={s.slug} /></div>}
            </section>
          );
        })}
      </div>
    </>
  );
}
