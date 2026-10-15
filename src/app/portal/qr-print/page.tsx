import { requireUser } from "@/lib/auth";
import { getTables } from "@/lib/tables";
import { qrSvg } from "@/lib/qr";
import { CARD_COPY } from "@/lib/qr-cards";
import { Crest, Fleur } from "@/components/brand";
import PrintButton from "./PrintButton";

export const metadata = { title: "Print QR cards" };
export const dynamic = "force-dynamic";

export default async function QrPrint({ searchParams }: { searchParams: Promise<{ size?: string; section?: string }> }) {
  await requireUser();
  const sp = await searchParams;
  const size = sp.size === "bill" ? "bill" : "table";
  const sections = (await getTables()).filter((s) => !sp.section || s.slug === sp.section);
  const cards = await Promise.all(
    sections.flatMap((s) => [undefined, ...s.tables].map(async (t) => ({ key: `${s.slug}-${t ?? "all"}`, label: t ? `${s.en} · Table ${t}` : s.en, svg: await qrSvg(s.slug, t) }))),
  );

  return (
    <div className="min-h-dvh bg-[#e9e4d8] py-8 text-[#1f2421] print:bg-white print:py-0" data-theme="light">
      <style>{`
        @page { size: A4; margin: 0; }
        .sheet { width: 210mm; margin: 0 auto 10mm; background: white; display: grid; box-shadow: 0 4px 20px rgb(0 0 0 / .15); }
        .sheet.table { grid-template-columns: repeat(2, 105mm); grid-auto-rows: 148mm; padding: 0.5mm 0; }
        .sheet.bill { grid-template-columns: repeat(2, 85mm); grid-auto-rows: 55mm; justify-content: center; padding: 10mm 0; }
        .cut { outline: 0.2mm dashed #ccc; outline-offset: -0.1mm; padding: 5mm; }
        .sheet.bill .cut { padding: 2.5mm; }
        .le-card { height: 100%; background: #FAF5EA; border: 0.6mm solid #C9A24B; position: relative; }
        .le-card::after { content: ""; position: absolute; inset: 1.4mm; border: 0.2mm solid #C9A24B; pointer-events: none; }
        .qr svg { width: 100%; height: 100%; display: block; }
        @media print { .sheet { box-shadow: none; margin: 0; break-after: page; } .cut { outline-color: #ddd; } * { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
      `}</style>
      <div className="no-print mx-auto mb-6 flex max-w-[210mm] flex-wrap items-center justify-between gap-3 px-2">
        <div>
          <h1 className="font-serif text-2xl font-semibold">{size === "table" ? "Table cards · A6, four per A4 sheet" : "Bill-folder cards · 85×55 mm, ten per sheet"}</h1>
          <p className="text-sm text-[#625f57]">Print at 100% scale on ivory card (300 gsm), then cut along the dashed lines. {cards.length} cards.</p>
        </div>
        <PrintButton />
      </div>
      {chunk(cards, size === "table" ? 4 : 10).map((page, i) => (
        <div key={i} className={`sheet ${size}`}>
          {page.map((c) => (
            <div key={c.key} className="cut">
              {size === "table" ? (
                <div className="le-card flex flex-col items-center px-[7mm] pt-[6mm] pb-[5mm] text-center">
                  <Crest size={72} />
                  <div className="mt-[2.5mm] font-serif text-[17pt] leading-none font-semibold">The Lord Erroll</div>
                  <div className="mt-[1.2mm] text-[6pt] tracking-[0.3em] text-[#87661c] uppercase">Gourmet Restaurant</div>
                  <div className="gold-rule my-[3mm] w-[34mm] text-[#C9A24B]"><Fleur className="h-[3mm] w-[3mm]" /></div>
                  <div className="font-serif text-[19pt] leading-tight text-[#1F5E3A] italic">{CARD_COPY.title}</div>
                  <div className="qr mt-[3mm] h-[44mm] w-[44mm] border border-[#C9A24B] bg-white p-[1.5mm]" dangerouslySetInnerHTML={{ __html: c.svg }} />
                  <p className="mt-[3mm] text-[7pt] leading-snug text-[#625f57]">{CARD_COPY.line}</p>
                  <div className="mt-auto text-[6.5pt] tracking-[0.18em] text-[#87661c] uppercase">{c.label}</div>
                </div>
              ) : (
                <div className="le-card flex items-center gap-[3mm] px-[5mm] py-[3.5mm]">
                  <div className="flex h-full min-w-0 flex-1 flex-col">
                    <div className="flex items-center gap-[2mm]">
                      <Crest size={26} />
                      <div>
                        <div className="font-serif text-[10.5pt] leading-none font-semibold">The Lord Erroll</div>
                        <div className="mt-[0.6mm] text-[4.6pt] tracking-[0.26em] text-[#87661c] uppercase">Gourmet Restaurant</div>
                      </div>
                    </div>
                    <div className="mt-auto font-serif text-[12pt] leading-tight text-[#1F5E3A] italic">{CARD_COPY.title}</div>
                    <div className="text-[5.6pt] text-[#625f57]">{CARD_COPY.small} · {CARD_COPY.time}</div>
                    <div className="mt-[1.5mm] text-[4.8pt] tracking-[0.16em] text-[#87661c] uppercase">{c.label}</div>
                  </div>
                  <div className="qr h-[38mm] w-[38mm] shrink-0 bg-white p-[1mm]" dangerouslySetInnerHTML={{ __html: c.svg }} />
                </div>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function chunk<T>(a: T[], n: number) {
  const out: T[][] = [];
  for (let i = 0; i < a.length; i += n) out.push(a.slice(i, i + n));
  return out;
}
