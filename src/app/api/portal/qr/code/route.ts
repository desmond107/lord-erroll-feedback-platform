import { getUser } from "@/lib/auth";
import { SECTION_SLUGS } from "@/lib/config";
import { TABLE_RE } from "@/lib/validation";
import { qrFileName, qrPng, qrSvg } from "@/lib/qr";

export async function GET(req: Request) {
  if (!(await getUser())) return new Response("Unauthorised", { status: 401 });
  const sp = new URL(req.url).searchParams;
  const section = sp.get("section") || "";
  const table = sp.get("table") || undefined;
  if (!(SECTION_SLUGS as string[]).includes(section) || (table && !TABLE_RE.test(table))) return new Response("Bad request", { status: 400 });
  if (sp.get("format") === "svg") {
    return new Response(await qrSvg(section, table), {
      headers: { "Content-Type": "image/svg+xml", "Content-Disposition": `attachment; filename="${qrFileName(section, table, "svg")}"` },
    });
  }
  return new Response(new Uint8Array(await qrPng(section, table, 1200)), {
    headers: { "Content-Type": "image/png", "Content-Disposition": `attachment; filename="${qrFileName(section, table, "png")}"` },
  });
}
