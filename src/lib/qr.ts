import "server-only";
import QRCode from "qrcode";
import { feedbackUrl, sectionLabel } from "./config";

const OPTS = { errorCorrectionLevel: "Q" as const, margin: 1, color: { dark: "#1F2421", light: "#FFFFFF" } };

export function qrSvg(section: string, table?: string) {
  return QRCode.toString(feedbackUrl(section, table), { ...OPTS, type: "svg" });
}

export function qrPng(section: string, table?: string, width = 1024) {
  return QRCode.toBuffer(feedbackUrl(section, table), { ...OPTS, type: "png", width });
}

export function qrFileName(section: string, table?: string, ext = "png") {
  return `lord-erroll-${section}${table ? `-table-${table}` : ""}.${ext}`;
}

export function qrCaption(section: string, table?: string) {
  return `${sectionLabel(section)}${table ? ` · Table ${table}` : ""}`;
}
