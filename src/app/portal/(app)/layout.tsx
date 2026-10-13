import { prisma } from "@/lib/db";
import { ROLE_LABELS, can, requireUser } from "@/lib/auth";
import { counts } from "@/lib/portal-data";
import PortalNav from "@/components/portal/PortalNav";
import LiveWatcher from "@/components/portal/LiveWatcher";

export const dynamic = "force-dynamic";
export const metadata = { title: { default: "Owner portal", template: "%s · Lord Erroll portal" } };

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [c, latest] = await Promise.all([counts(user.id), prisma.feedback.findFirst({ orderBy: { number: "desc" }, select: { number: true } })]);
  const items = [
    { href: "/portal", label: "Inbox", icon: "inbox" as const, badge: "unread" as const },
    { href: "/portal/insights", label: "Insights", icon: "chart" as const },
    { href: "/portal/qr", label: "QR codes", icon: "qr" as const },
    ...(can(user, "users") ? [{ href: "/portal/team", label: "Team", icon: "team" as const }] : []),
    ...(can(user, "activity") ? [{ href: "/portal/activity", label: "Activity log", icon: "log" as const }] : []),
    { href: "/portal/settings", label: "Settings", icon: "cog" as const },
  ];
  return (
    <div className="min-h-dvh bg-bg lg:flex">
      <PortalNav user={{ name: user.name, role: ROLE_LABELS[user.role] }} items={items} initial={c} />
      <div className="min-w-0 flex-1">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10">{children}</div>
      </div>
      <LiveWatcher initialLatest={latest?.number ?? 0} />
    </div>
  );
}
