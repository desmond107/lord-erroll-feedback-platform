"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { FeedbackStatus } from "@prisma/client";
import { REPLY_TEMPLATES, fillTemplate } from "@/lib/reply-templates";
import { addNote, assign, markUnread, sendReply, setStatus, toggleFlag } from "./actions";

type Res = { ok: boolean; error?: string; message?: string; waUrl?: string };

function useAct() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const run = (fn: () => Promise<Res>, onOk?: (r: Res) => void) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) setMsg({ ok: false, text: r.error ?? "Something went wrong." });
      else {
        setMsg(r.message ? { ok: true, text: r.message } : null);
        onOk?.(r);
      }
    });
  return { pending, msg, run, setMsg };
}

const STATUSES: { v: FeedbackStatus; label: string }[] = [
  { v: "NEW", label: "New" },
  { v: "IN_PROGRESS", label: "In progress" },
  { v: "RESOLVED", label: "Resolved" },
];

export function ManagePanel({
  id, status, starred, pinned, assigneeId, managers, canManage,
}: { id: string; status: FeedbackStatus; starred: boolean; pinned: boolean; assigneeId: string | null; managers: { id: string; name: string }[]; canManage: boolean }) {
  const { pending, msg, run } = useAct();
  const router = useRouter();
  return (
    <div className="space-y-4">
      <div>
        <span className="label">Status</span>
        <div className="grid grid-cols-3 gap-1 rounded-full border border-line bg-bg p-1" role="radiogroup" aria-label="Status">
          {STATUSES.map((s) => (
            <button
              key={s.v}
              type="button"
              role="radio"
              aria-checked={status === s.v}
              disabled={!canManage || pending}
              onClick={() => run(() => setStatus(id, s.v))}
              className={`rounded-full px-2 py-2 text-xs font-medium transition-colors sm:text-sm ${
                status === s.v ? (s.v === "RESOLVED" ? "bg-ink text-bg" : s.v === "IN_PROGRESS" ? "bg-green text-on-accent" : "bg-gold text-[#1f2421]") : "text-muted hover:text-ink"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
      <label className="block">
        <span className="label">Assigned to</span>
        <select className="field py-2 text-sm" disabled={!canManage || pending} value={assigneeId ?? ""} onChange={(e) => run(() => assign(id, e.target.value || null))}>
          <option value="">Unassigned</option>
          {managers.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
      </label>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={!canManage || pending} onClick={() => run(() => toggleFlag(id, "starred"))} className={`btn btn-sm ${starred ? "bg-gold text-[#1f2421]" : "btn-ghost"}`} aria-pressed={starred}>
          {starred ? "★ Starred" : "☆ Star"}
        </button>
        <button type="button" disabled={!canManage || pending} onClick={() => run(() => toggleFlag(id, "pinned"))} className={`btn btn-sm ${pinned ? "bg-green text-on-accent" : "btn-ghost"}`} aria-pressed={pinned}>
          📌 {pinned ? "Pinned" : "Pin to top"}
        </button>
        <button type="button" disabled={pending} onClick={() => run(() => markUnread(id), () => router.push("/portal"))} className="btn btn-ghost btn-sm">
          Mark unread
        </button>
      </div>
      {msg && <p className={`text-sm ${msg.ok ? "text-green" : "text-crimson"}`}>{msg.text}</p>}
    </div>
  );
}

export function NoteForm({ id }: { id: string }) {
  const [body, setBody] = useState("");
  const { pending, msg, run } = useAct();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        run(() => addNote(id, body), () => setBody(""));
      }}
      className="space-y-2"
    >
      <textarea className="field min-h-20 text-sm" placeholder="Private note for the team — guests never see this." value={body} onChange={(e) => setBody(e.target.value)} maxLength={4000} />
      <div className="flex items-center justify-between gap-2">
        {msg ? <p className="text-sm text-crimson">{msg.text}</p> : <span />}
        <button className="btn btn-green btn-sm" disabled={pending || !body.trim()}>{pending ? "Saving…" : "Add note"}</button>
      </div>
    </form>
  );
}

export function ReplyComposer({
  id, email, phone, vars, overall, staffName,
}: { id: string; email: string | null; phone: string | null; vars: Record<string, string>; overall: number; staffName: string | null }) {
  const channels = [email && ("EMAIL" as const), phone && ("WHATSAPP" as const)].filter(Boolean) as ("EMAIL" | "WHATSAPP")[];
  const suits = overall >= 4 ? "high" : "low";
  const templates = REPLY_TEMPLATES.filter((t) => t.key !== "staff-praise" || staffName).sort((a, b) => Number(b.suits === suits) - Number(a.suits === suits));
  const first = templates[0];
  const [channel, setChannel] = useState(channels[0]);
  const [tpl, setTpl] = useState(first.key);
  const [subject, setSubject] = useState(fillTemplate(first.subject, vars));
  const [body, setBody] = useState(fillTemplate(first.body, vars));
  const [open, setOpen] = useState(false);
  const { pending, msg, run } = useAct();

  if (!channels.length) return <p className="text-sm text-muted">This guest chose to stay anonymous, so there is no way to reply.</p>;

  const pick = (key: string) => {
    const t = REPLY_TEMPLATES.find((x) => x.key === key)!;
    setTpl(key);
    setSubject(fillTemplate(t.subject, vars));
    setBody(fillTemplate(t.body, vars));
  };

  if (!open)
    return (
      <div className="flex flex-wrap gap-2">
        {msg && <p className={`w-full text-sm ${msg.ok ? "text-green" : "text-crimson"}`}>{msg.text}</p>}
        {channels.includes("EMAIL") && <button type="button" className="btn btn-green btn-sm" onClick={() => { setChannel("EMAIL"); setOpen(true); }}>✉ Reply by email</button>}
        {channels.includes("WHATSAPP") && <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setChannel("WHATSAPP"); setOpen(true); }}>💬 Reply on WhatsApp</button>}
      </div>
    );

  return (
    <div className="anim-fade space-y-3">
      <div className="flex gap-1 rounded-full border border-line bg-bg p-1 text-sm">
        {channels.map((c) => (
          <button key={c} type="button" onClick={() => setChannel(c)} className={`flex-1 rounded-full px-3 py-1.5 ${channel === c ? "bg-green text-on-accent" : "text-muted"}`}>
            {c === "EMAIL" ? "Email" : "WhatsApp"}
          </button>
        ))}
      </div>
      <label className="block">
        <span className="label">Template</span>
        <select className="field py-2 text-sm" value={tpl} onChange={(e) => pick(e.target.value)}>
          {templates.map((t) => (
            <option key={t.key} value={t.key}>
              {t.label}{t.suits === suits ? " · suggested" : ""}
            </option>
          ))}
        </select>
      </label>
      {channel === "EMAIL" && (
        <label className="block">
          <span className="label">Subject</span>
          <input className="field py-2 text-sm" value={subject} onChange={(e) => setSubject(e.target.value)} />
        </label>
      )}
      <label className="block">
        <span className="label">Message · to {channel === "EMAIL" ? email : phone}</span>
        <textarea className="field min-h-72 font-serif text-[1.02rem] leading-relaxed" value={body} onChange={(e) => setBody(e.target.value)} />
      </label>
      {msg && <p className={`text-sm ${msg.ok ? "text-green" : "text-crimson"}`}>{msg.text}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>Cancel</button>
        <button
          type="button"
          className="btn btn-green btn-sm"
          disabled={pending || body.trim().length < 10}
          onClick={() => {
            // Open the WhatsApp tab synchronously so pop-up blockers allow it.
            const wa = channel === "WHATSAPP" ? window.open("about:blank", "_blank") : null;
            run(() => sendReply(id, { channel, templateKey: tpl, subject, body }), (r) => {
              if (r.waUrl && wa) wa.location.href = r.waUrl;
              setOpen(false);
            });
          }}
        >
          {pending ? "Sending…" : channel === "EMAIL" ? "Send email" : "Open WhatsApp"}
        </button>
      </div>
    </div>
  );
}
