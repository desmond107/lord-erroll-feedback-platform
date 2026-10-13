import "server-only";
import JSZip from "jszip";
import { feedbackUrl } from "./config";
import { qrFileName, qrPng, qrSvg } from "./qr";
import { qrCardsPdf, type CardSpec } from "./qr-cards";

export async function buildQrZip(sections: { slug: string; en: string; tables: string[] }[]) {
  const zip = new JSZip();
  const cards: CardSpec[] = [];
  const index: string[] = ["section,table,url,png,svg"];
  for (const s of sections) {
    const dir = zip.folder(s.slug)!;
    for (const t of [undefined, ...s.tables]) {
      dir.file(qrFileName(s.slug, t, "png"), await qrPng(s.slug, t, 1200));
      dir.file(qrFileName(s.slug, t, "svg"), await qrSvg(s.slug, t));
      index.push([s.en, t ?? "(section)", feedbackUrl(s.slug, t), `${s.slug}/${qrFileName(s.slug, t, "png")}`, `${s.slug}/${qrFileName(s.slug, t, "svg")}`].join(","));
      cards.push({ section: s.slug, table: t });
    }
  }
  zip.file("index.csv", index.join("\n"));
  zip.file("print/table-cards-A6.pdf", await qrCardsPdf(cards, "table"));
  zip.file("print/bill-folder-cards.pdf", await qrCardsPdf(cards, "bill"));
  zip.file(
    "README.txt",
    [
      "The Lord Erroll — feedback QR codes",
      "",
      "print/table-cards-A6.pdf      Four A6 table cards per A4 sheet. Print at 100% (no scaling) on 300gsm ivory card, then cut on the hairlines.",
      "print/bill-folder-cards.pdf   Ten 85×55 mm cards per A4 sheet for bill folders and menus.",
      "<section>/*.png|svg           Individual codes (1200 px PNG, and vector SVG for professional printers).",
      "index.csv                     Every code and the link it opens.",
      "",
      "Section-only codes (no table number) are useful for the bar counter and lounge.",
    ].join("\n"),
  );
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}
