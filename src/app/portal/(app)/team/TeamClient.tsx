"use client";

import { useState, useTransition } from "react";
import type { Role } from "@prisma/client";
import { createUser, removeUser, resetPassword, updateUser } from "./actions";

const ROLES: { v: Role; label: string; desc: string }[] = [
  { v: "OWNER", label: "Owner", desc: "Full access, including team and activity log" },
  { v: "MANAGER", label: "Manager", desc: "View, reply, manage status, notes and exports" },
  { v: "SUPERVISOR", label: "Supervisor", desc: "View only" },
];

function Secret({ pw, who }: { pw: string; who: string }) {
  return (
    <div className="anim-fade rounded-xl border border-gold bg-gold-soft p-4 text-sm">
      <p>Temporary password for <b>{who}</b> — share it privately. They can change it under Settings after signing in.</p>
      <p className="mt-2 font-mono text-lg tracking-wide select-all">{pw}</p>
    </div>
  );
}

export function AddUser() {
  const [f, setF] = useState({ name: "", email: "", role: "MANAGER" as Role });
  const [msg, setMsg] = useState<{ err?: string; pw?: string; who?: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await createUser(f);
          setMsg(r.ok ? { pw: r.tempPassword, who: f.email } : { err: r.error });
          if (r.ok) setF({ name: "", email: "", role: "MANAGER" });
        });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block"><span className="label">Name</span><input className="field py-2" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
        <label className="block"><span className="label">Email</span><input className="field py-2" type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
        <label className="block">
          <span className="label">Role</span>
          <select className="field py-2" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as Role })}>
            {ROLES.map((r) => <option key={r.v} value={r.v}>{r.label} — {r.desc}</option>)}
          </select>
        </label>
      </div>
      <button className="btn btn-green btn-sm" disabled={pending}>{pending ? "Adding…" : "Add team member"}</button>
      {msg?.err && <p className="text-sm text-crimson">{msg.err}</p>}
      {msg?.pw && <Secret pw={msg.pw} who={msg.who!} />}
    </form>
  );
}

export function UserRow({ u, isMe }: { u: { id: string; name: string; email: string; role: Role; active: boolean; totpEnabled: boolean; lastLogin: string }; isMe: boolean }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ err?: string; pw?: string } | null>(null);
  const run = (fn: () => Promise<{ ok: boolean; error?: string; tempPassword?: string }>) =>
    start(async () => {
      const r = await fn();
      setMsg(r.ok ? (r.tempPassword ? { pw: r.tempPassword } : null) : { err: r.error });
    });
  return (
    <li className={`px-4 py-4 sm:px-5 ${u.active ? "" : "opacity-60"}`}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-full bg-green-soft font-serif text-lg font-semibold text-green">{u.name.slice(0, 1)}</div>
        <div className="min-w-0 flex-1">
          <div className="font-medium">{u.name} {isMe && <span className="text-xs text-muted">(you)</span>} {!u.active && <span className="text-xs text-crimson">· deactivated</span>}</div>
          <div className="text-sm text-muted">{u.email} · {u.totpEnabled ? "2FA on" : "2FA off"} · last sign-in {u.lastLogin}</div>
        </div>
        <select className="field w-auto py-1.5 text-sm" value={u.role} disabled={pending || isMe} onChange={(e) => run(() => updateUser(u.id, { role: e.target.value as Role }))} aria-label="Role">
          {ROLES.map((r) => <option key={r.v} value={r.v}>{r.label}</option>)}
        </select>
        {!isMe && (
          <div className="flex gap-1">
            <button type="button" className="btn btn-ghost btn-sm" disabled={pending} onClick={() => run(() => resetPassword(u.id))}>Reset password</button>
            <button type="button" className="btn btn-ghost btn-sm" disabled={pending} onClick={() => run(() => updateUser(u.id, { active: !u.active }))}>{u.active ? "Deactivate" : "Reactivate"}</button>
            <button type="button" className="btn btn-ghost btn-sm text-crimson" disabled={pending} onClick={() => confirm(`Remove ${u.name}? Their notes stay, attributed to "Former user".`) && run(() => removeUser(u.id))}>Remove</button>
          </div>
        )}
      </div>
      {msg?.err && <p className="mt-2 text-sm text-crimson">{msg.err}</p>}
      {msg?.pw && <div className="mt-3"><Secret pw={msg.pw} who={u.email} /></div>}
    </li>
  );
}
