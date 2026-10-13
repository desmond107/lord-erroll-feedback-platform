import { getUser } from "@/lib/auth";
import { getTables } from "@/lib/tables";
import { buildQrZip } from "@/lib/qr-zip";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  if (!(await getUser())) return new Response("Unauthorised", { status: 401 });
  const buf = await buildQrZip(await getTables());
  return new Response(new Uint8Array(buf), {
    headers: { "Content-Type": "application/zip", "Content-Disposition": 'attachment; filename="lord-erroll-qr-codes.zip"' },
  });
}
