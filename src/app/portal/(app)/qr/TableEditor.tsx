"use client";

import { useState, useTransition } from "react";
import { addTables, removeTable } from "./actions";

export function AddTables({ section }: { section: string }) {
  const [v, setV] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await addTables(section, v);
          setErr(r.ok ? null : r.error ?? "Could not add");
          if (r.ok) setV("");
        });
      }}
    >
      <input className="field w-40 py-1.5 text-sm" placeholder="e.g. 41 or 41-45" value={v} onChange={(e) => setV(e.target.value)} aria-label="Add tables" />
      <button className="btn btn-ghost btn-sm" disabled={pending || !v.trim()}>Add tables</button>
      {err && <span className="text-sm text-crimson">{err}</span>}
    </form>
  );
}

export function RemoveTable({ section, number }: { section: string; number: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className="text-xs text-muted hover:text-crimson"
      disabled={pending}
      onClick={() => confirm(`Remove table ${number}? Its past feedback is kept.`) && start(async () => void (await removeTable(section, number)))}
    >
      Remove
    </button>
  );
}
