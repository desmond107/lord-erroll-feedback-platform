import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ACTIVITY_LABELS } from "@/lib/activity";
import { fmtDateTime } from "@/lib/format";
import { PageHeader } from "@/components/portal/ui";

export const metadata = { title: "Activity log" };
const PAGE = 50;

export default async function Activity({ searchParams }: { searchParams: Promise<{ page?: string; user?: string; action?: string }> }) {
  await requireUser("activity");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const where = { ...(sp.user ? { userId: sp.user } : {}), ...(sp.action ? { action: { startsWith: sp.action } } : {}) };
  const [rows, total, users] = await Promise.all([
    prisma.activityLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE, include: { user: { select: { name: true } } } }),
    prisma.activityLog.count({ where }),
    prisma.user.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const q = (o: Record<string, string | undefined>) => {
    const p = new URLSearchParams(Object.entries({ user: sp.user, action: sp.action, ...o }).filter(([, v]) => v) as [string, string][]);
    return `/portal/activity${p.size ? `?${p}` : ""}`;
  };
  return (
    <>
      <PageHeader title="Activity log" subtitle={`Every sign-in, change, reply and export · ${total} entries`} />
      <form className="card mb-4 flex flex-wrap items-end gap-3 p-4" method="get">
        <label className="block">
          <span className="label">Person</span>
          <select name="user" defaultValue={sp.user ?? ""} className="field py-2 text-sm">
            <option value="">Everyone</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="label">Type</span>
          <select name="action" defaultValue={sp.action ?? ""} className="field py-2 text-sm">
            <option value="">All activity</option>
            <option value="auth">Sign-ins</option>
            <option value="feedback">Feedback handling</option>
            <option value="user">Team changes</option>
            <option value="tables">Tables</option>
          </select>
        </label>
        <button className="btn btn-green btn-sm">Filter</button>
      </form>
      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line text-xs tracking-wide text-muted uppercase">
            <tr><th className="px-4 py-3">When</th><th className="px-4 py-3">Who</th><th className="px-4 py-3">What</th><th className="px-4 py-3">Item</th><th className="px-4 py-3">Detail</th></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.id} className={r.action === "auth.login_failed" ? "bg-crimson-soft/40" : ""}>
                <td className="px-4 py-2.5 whitespace-nowrap text-muted">{fmtDateTime(r.createdAt)}</td>
                <td className="px-4 py-2.5 whitespace-nowrap">{r.user?.name ?? <span className="text-muted">—</span>}</td>
                <td className="px-4 py-2.5">{ACTIVITY_LABELS[r.action] ?? r.action}</td>
                <td className="px-4 py-2.5">{r.target}</td>
                <td className="max-w-xs truncate px-4 py-2.5 text-muted" title={r.detail ?? ""}>{r.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex justify-between text-sm">
        {page > 1 ? <Link className="btn btn-ghost btn-sm" href={q({ page: String(page - 1) })}>← Newer</Link> : <span />}
        {page * PAGE < total ? <Link className="btn btn-ghost btn-sm" href={q({ page: String(page + 1) })}>Older →</Link> : <span />}
      </div>
    </>
  );
}
