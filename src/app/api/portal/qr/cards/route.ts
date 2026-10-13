import { getUser } from "@/lib/auth";
import { getTables } from "@/lib/tables";
import { qrCardsPdf, type CardSpec } from "@/lib/qr-cards";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: Request) {
  if (!(await getUser())) return new Response("Unauthorised", { status: 401 });
  const sp = new URL(req.url).searchParams;
  const size = sp.get("size") === "bill" ? "bill" : "table";
  const only = sp.get("section");
  const sections = (await getTables()).filter((s) => !only || s.slug === only);
  const cards: CardSpec[] = sections.flatMap((s) => [{ section: s.slug }, ...s.tables.map((t) => ({ section: s.slug, table: t }))]);
  const pdf = await qrCardsPdf(cards, size);
  return new Response(new Uint8Array(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="lord-erroll-${size}-cards.pdf"` },
  });
}
