import "server-only";
import fs from "fs/promises";
import path from "path";
import { PDFDocument, StandardFonts, rgb, type PDFPage } from "pdf-lib";
import { RESTAURANT, sectionLabel } from "./config";
import { qrPng } from "./qr";

// Card wording, shared by the HTML print page and the PDF.
export const CARD_COPY = {
  title: "Share your experience",
  line: "It was our pleasure to host you. Scan to tell us about your visit — every word is read by our owner.",
  swahili: "Shiriki uzoefu wako",
  small: "Scan to share your thoughts",
  time: "About one minute",
};

const mm = (v: number) => (v * 72) / 25.4;
const hex = (h: string) => rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255);
const IVORY = hex("#FAF5EA"), GOLD = hex("#C9A24B"), GREEN = hex("#1F5E3A"), INK = hex("#1F2421"), MUTED = hex("#6B6A63"), GOLDINK = hex("#87661C");

export type CardSpec = { section: string; table?: string };

/**
 * Table cards: A6 portrait (105×148 mm), four per A4 sheet, with crop space.
 * Bill-folder cards: 85×55 mm, ten per A4 sheet.
 */
export async function qrCardsPdf(cards: CardSpec[], size: "table" | "bill") {
  const doc = await PDFDocument.create();
  doc.setTitle(`${RESTAURANT.fullName} — QR ${size === "table" ? "table cards" : "bill-folder cards"}`);
  const serif = await doc.embedFont(StandardFonts.TimesRoman);
  const serifBold = await doc.embedFont(StandardFonts.TimesRomanBold);
  const serifItalic = await doc.embedFont(StandardFonts.TimesRomanItalic);
  const sans = await doc.embedFont(StandardFonts.Helvetica);
  const crest = await doc.embedPng(await fs.readFile(path.join(process.cwd(), "public", "brand", "crest-240.png")));

  const A4 = { w: mm(210), h: mm(297) };
  const layout = size === "table" ? { w: mm(105), h: mm(148), cols: 2, rows: 2 } : { w: mm(85), h: mm(55), cols: 2, rows: 5 };
  const perPage = layout.cols * layout.rows;
  const offX = (A4.w - layout.cols * layout.w) / 2;
  const offY = (A4.h - layout.rows * layout.h) / 2;

  const centre = (page: PDFPage, text: string, x: number, w: number, y: number, size: number, font = serif, color = INK) =>
    page.drawText(text, { x: x + (w - font.widthOfTextAtSize(text, size)) / 2, y, size, font, color });

  const wrap = (text: string, font = sans, size: number, width: number) => {
    const out: string[] = [];
    let line = "";
    for (const w of text.split(" ")) {
      const t = line ? `${line} ${w}` : w;
      if (font.widthOfTextAtSize(t, size) > width && line) {
        out.push(line);
        line = w;
      } else line = t;
    }
    if (line) out.push(line);
    return out;
  };

  let page!: PDFPage;
  for (let i = 0; i < cards.length; i++) {
    if (i % perPage === 0) page = doc.addPage([A4.w, A4.h]);
    const slot = i % perPage;
    const col = slot % layout.cols, row = Math.floor(slot / layout.cols);
    const x = offX + col * layout.w;
    const y = A4.h - offY - (row + 1) * layout.h;
    const { section, table } = cards[i];
    const qr = await doc.embedPng(await qrPng(section, table, 600));
    const where = table ? `${sectionLabel(section)} · Table ${table}` : sectionLabel(section);

    // Cut guides (hairline) + ivory card + double gold border.
    page.drawRectangle({ x, y, width: layout.w, height: layout.h, borderColor: rgb(0.85, 0.85, 0.85), borderWidth: 0.25 });
    const inset = mm(size === "table" ? 5 : 3);
    page.drawRectangle({ x: x + inset, y: y + inset, width: layout.w - 2 * inset, height: layout.h - 2 * inset, color: IVORY, borderColor: GOLD, borderWidth: 1.4 });
    page.drawRectangle({ x: x + inset + 3.5, y: y + inset + 3.5, width: layout.w - 2 * inset - 7, height: layout.h - 2 * inset - 7, borderColor: GOLD, borderWidth: 0.4 });

    if (size === "table") {
      const cw = mm(19), ch = (cw * crest.height) / crest.width;
      let cy = y + layout.h - inset - mm(6) - ch;
      page.drawImage(crest, { x: x + (layout.w - cw) / 2, y: cy, width: cw, height: ch });
      cy -= mm(6);
      centre(page, "The Lord Erroll", x, layout.w, cy, 15, serifBold, INK);
      cy -= mm(3.6);
      centre(page, "GOURMET RESTAURANT", x, layout.w, cy, 5.8, sans, GOLDINK);
      cy -= mm(4);
      page.drawLine({ start: { x: x + layout.w / 2 - mm(14), y: cy }, end: { x: x + layout.w / 2 + mm(14), y: cy }, thickness: 0.6, color: GOLD });
      cy -= mm(8);
      centre(page, CARD_COPY.title, x, layout.w, cy, 17, serifItalic, GREEN);
      cy -= mm(4.6);
      centre(page, CARD_COPY.swahili, x, layout.w, cy, 9, serifItalic, MUTED);
      const q = mm(54);
      cy -= mm(3) + q;
      page.drawRectangle({ x: x + (layout.w - q) / 2 - 4, y: cy - 4, width: q + 8, height: q + 8, color: rgb(1, 1, 1), borderColor: GOLD, borderWidth: 0.6 });
      page.drawImage(qr, { x: x + (layout.w - q) / 2, y: cy, width: q, height: q });
      cy -= mm(6);
      for (const l of wrap(CARD_COPY.line, sans, 6.6, layout.w - 2 * inset - mm(12))) {
        centre(page, l, x, layout.w, cy, 6.6, sans, MUTED);
        cy -= mm(3.1);
      }
      centre(page, where.toUpperCase(), x, layout.w, y + inset + mm(5), 6.5, sans, GOLDINK);
    } else {
      const q = mm(31);
      const qx = x + layout.w - inset - mm(4.5) - q, qy = y + (layout.h - q) / 2;
      page.drawRectangle({ x: qx - 2, y: qy - 2, width: q + 4, height: q + 4, color: rgb(1, 1, 1), borderColor: GOLD, borderWidth: 0.4 });
      page.drawImage(qr, { x: qx, y: qy, width: q, height: q });
      const tx = x + inset + mm(4.5);
      const cw = mm(8), ch = (cw * crest.height) / crest.width;
      const top = y + layout.h - inset - mm(4);
      page.drawImage(crest, { x: tx, y: top - ch, width: cw, height: ch });
      page.drawText("The Lord Erroll", { x: tx + cw + mm(2), y: top - mm(4.2), size: 9.5, font: serifBold, color: INK });
      page.drawText("GOURMET RESTAURANT", { x: tx + cw + mm(2), y: top - mm(6.6), size: 4.4, font: sans, color: GOLDINK });
      page.drawText("Share your", { x: tx, y: y + mm(25), size: 12, font: serifItalic, color: GREEN });
      page.drawText("experience", { x: tx, y: y + mm(20.5), size: 12, font: serifItalic, color: GREEN });
      page.drawText(CARD_COPY.small, { x: tx, y: y + mm(16), size: 5.6, font: sans, color: MUTED });
      page.drawText(CARD_COPY.swahili, { x: tx, y: y + mm(12.8), size: 6.5, font: serifItalic, color: MUTED });
      page.drawText(where.toUpperCase(), { x: tx, y: y + inset + mm(3.5), size: 4.8, font: sans, color: GOLDINK });
    }
  }
  return Buffer.from(await doc.save());
}
