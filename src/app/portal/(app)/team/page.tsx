import { prisma } from "@/lib/db";
import { ROLE_DESCRIPTIONS, ROLE_LABELS, requireUser } from "@/lib/auth";
import { fmtRelative } from "@/lib/format";
import { PageHeader } from "@/components/portal/ui";
import { AddUser, UserRow } from "./TeamClient";

export const metadata = { title: "Team" };

export default async function Team() {
  const me = await requireUser("users");
  const users = await prisma.user.findMany({ orderBy: [{ active: "desc" }, { role: "asc" }, { name: "asc" }] });
  return (
    <>
      <PageHeader title="Team" subtitle="Who can open the portal, and what they can do." />
      <section className="card mb-5 p-5">
        <h2 className="mb-3 font-serif text-xl font-semibold">Add a team member</h2>
        <AddUser />
      </section>
      <ul className="card divide-y divide-line overflow-hidden">
        {users.map((u) => (
          <UserRow
            key={u.id}
            isMe={u.id === me.id}
            u={{ id: u.id, name: u.name, email: u.email, role: u.role, active: u.active, totpEnabled: u.totpEnabled, lastLogin: u.lastLoginAt ? fmtRelative(u.lastLoginAt) : "never" }}
          />
        ))}
      </ul>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {(Object.keys(ROLE_LABELS) as (keyof typeof ROLE_LABELS)[]).map((r) => (
          <div key={r} className="rounded-xl border border-line p-4 text-sm">
            <div className="font-serif text-lg font-semibold">{ROLE_LABELS[r]}</div>
            <div className="text-muted">{ROLE_DESCRIPTIONS[r]}</div>
          </div>
        ))}
      </div>
    </>
  );
}
