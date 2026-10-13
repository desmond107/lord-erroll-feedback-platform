import "server-only";
import ExcelJS from "exceljs";
import type { Feedback, User } from "@prisma/client";
import { CATEGORIES, feedbackRef, highlightLabel, improvementLabel, occasionLabel, sectionLabel } from "./config";
import { fmtDateTime, fmtVisitDate } from "./format";

export type ExportRow = Feedback & { assignee: Pick<User, "name"> | null; _count: { photos: number; notes: number } };

const COLUMNS: { header: string; width: number; get: (f: ExportRow) => string | number | null }[] = [
  { header: "Ref", width: 10, get: (f) => feedbackRef(f.number) },
  { header: "Received", width: 20, get: (f) => fmtDateTime(f.createdAt) },
  { header: "Visit date", width: 16, get: (f) => fmtVisitDate(f.visitDate) },
  { header: "Section", width: 16, get: (f) => sectionLabel(f.section) },
  { header: "Table", width: 8, get: (f) => f.table },
  { header: "Occasion", width: 16, get: (f) => (f.occasion ? occasionLabel(f.occasion) : null) },
  { header: "Overall", width: 9, get: (f) => f.overall },
  ...CATEGORIES.map((c) => ({ header: c.en, width: 10, get: (f: ExportRow) => f[c.key as keyof Feedback] as number | null })),
  { header: "Recommend (0-10)", width: 12, get: (f) => f.nps },
  { header: "Stood out", width: 34, get: (f) => f.highlights.map(highlightLabel).join("; ") },
  { header: "Could be better", width: 34, get: (f) => f.improvements.map(improvementLabel).join("; ") },
  { header: "Staff mentioned", width: 18, get: (f) => f.staffName },
  { header: "Staff message", width: 34, get: (f) => f.staffMessage },
  { header: "Suggestion / comment", width: 60, get: (f) => f.suggestion },
  { header: "Guest name", width: 18, get: (f) => f.guestName || "Anonymous" },
  { header: "Guest email", width: 24, get: (f) => f.guestEmail },
  { header: "Guest phone", width: 16, get: (f) => f.guestPhone },
  { header: "Follow-up requested", width: 10, get: (f) => (f.followUp ? "Yes" : "No") },
  { header: "Urgent", width: 8, get: (f) => (f.urgent ? "Yes" : "No") },
  { header: "Sentiment", width: 10, get: (f) => f.sentiment.toLowerCase() },
  { header: "Status", width: 12, get: (f) => f.status.replace("_", " ").toLowerCase() },
  { header: "Assigned to", width: 16, get: (f) => f.assignee?.name ?? null },
  { header: "Starred", width: 8, get: (f) => (f.starred ? "Yes" : "No") },
  { header: "Photos", width: 8, get: (f) => f._count.photos },
  { header: "Internal notes", width: 8, get: (f) => f._count.notes },
  { header: "Language", width: 9, get: (f) => f.language },
];

function csvCell(v: string | number | null) {
  if (v == null) return "";
  let s = String(v);
  // Neutralise spreadsheet formula injection from guest-entered text.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: ExportRow[]) {
  const lines = [COLUMNS.map((c) => csvCell(c.header)).join(",")];
  for (const r of rows) lines.push(COLUMNS.map((c) => csvCell(c.get(r))).join(","));
  return "﻿" + lines.join("\r\n"); // BOM so Excel reads UTF-8 correctly
}

export async function toXlsx(rows: ExportRow[]) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "The Lord Erroll Feedback Portal";
  wb.created = new Date();
  const ws = wb.addWorksheet("Feedback", { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = COLUMNS.map((c) => ({ header: c.header, key: c.header, width: c.width }));
  for (const r of rows) {
    const row = ws.addRow(COLUMNS.map((c) => {
      const v = c.get(r);
      return typeof v === "string" && /^[=+\-@]/.test(v) ? `'${v}` : v;
    }));
    if (r.urgent) row.getCell(7).font = { bold: true, color: { argb: "FFA32A2A" } };
  }
  const header = ws.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F5E3A" } };
  header.alignment = { vertical: "middle", wrapText: true };
  header.height = 30;
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: COLUMNS.length } };
  ws.getColumn("Suggestion / comment").alignment = { wrapText: true, vertical: "top" };
  return Buffer.from(await wb.xlsx.writeBuffer());
}
