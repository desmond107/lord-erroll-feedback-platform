import { SECTION_SLUGS, guestLinks } from "@/lib/config";
import { TABLE_RE } from "@/lib/validation";
import GuestFlow from "./GuestFlow";

export const dynamic = "force-dynamic";

export default async function FeedbackPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const rawSection = typeof sp.section === "string" ? sp.section : "";
  const rawTable = typeof sp.table === "string" ? sp.table : "";
  const section = (SECTION_SLUGS as string[]).includes(rawSection) ? rawSection : "";
  const table = TABLE_RE.test(rawTable) ? rawTable : "";
  const { googleReview, instagram, facebook, tripadvisor } = guestLinks();
  return <GuestFlow qrSection={section} qrTable={table} links={{ googleReview, instagram, facebook, tripadvisor }} />;
}
