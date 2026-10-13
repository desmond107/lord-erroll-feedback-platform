"use client";

import { useRef } from "react";
import { OCCASIONS, SECTIONS } from "@/lib/config";

type F = Record<string, string | undefined>;

export default function FilterBar({ filters, action = "/portal", showView = true }: { filters: F; action?: string; showView?: boolean }) {
  const form = useRef<HTMLFormElement>(null);
  const submit = () => form.current?.requestSubmit();
  const advancedCount = ["status", "rating", "section", "table", "occasion", "staff", "from", "to"].filter((k) => filters[k]).length;

  return (
    <form ref={form} method="get" action={action} className="no-print card mb-5 p-3 sm:p-4">
      {showView && filters.view && <input type="hidden" name="view" value={filters.view} />}
      <div className="flex gap-2">
        <label className="relative flex-1">
          <span className="sr-only">Search</span>
          <svg viewBox="0 0 24 24" className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input name="q" defaultValue={filters.q} placeholder="Search comments, guests, staff, notes or LE-0123…" className="field py-2.5 pl-9 text-sm" />
        </label>
        <button className="btn btn-green btn-sm h-auto">Search</button>
      </div>
      <details className="group mt-3" open={advancedCount > 0}>
        <summary className="cursor-pointer list-none text-sm text-muted select-none">
          <span className="group-open:hidden">＋ More filters</span>
          <span className="hidden group-open:inline">− Fewer filters</span>
          {advancedCount > 0 && <span className="ml-2 rounded-full bg-gold-soft px-2 py-0.5 text-xs text-gold-ink">{advancedCount} active</span>}
        </summary>
        <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <Select name="status" label="Status" value={filters.status} onChange={submit} options={[["", "Any status"], ["OPEN", "Open (not resolved)"], ["NEW", "New"], ["IN_PROGRESS", "In progress"], ["RESOLVED", "Resolved"]]} />
          <Select name="rating" label="Rating" value={filters.rating} onChange={submit} options={[["", "Any rating"], ["urgent", "Urgent (1–3)"], ["positive", "Positive (4–5)"], ["5", "5"], ["4", "4"], ["3", "3"], ["2", "2"], ["1", "1"]]} />
          <Select name="section" label="Section" value={filters.section} onChange={submit} options={[["", "All sections"], ...SECTIONS.map((s) => [s.slug, s.en] as [string, string])]} />
          <Select name="occasion" label="Occasion" value={filters.occasion} onChange={submit} options={[["", "Any occasion"], ...OCCASIONS.map((o) => [o.key, o.en] as [string, string])]} />
          <label className="block">
            <span className="label">Table</span>
            <input name="table" defaultValue={filters.table} className="field py-2 text-sm" placeholder="Any" />
          </label>
          <label className="block">
            <span className="label">Staff member</span>
            <input name="staff" defaultValue={filters.staff} className="field py-2 text-sm" placeholder="Any" />
          </label>
          <label className="block">
            <span className="label">From</span>
            <input type="date" name="from" defaultValue={filters.from} onChange={submit} className="field py-2 text-sm" />
          </label>
          <label className="block">
            <span className="label">To</span>
            <input type="date" name="to" defaultValue={filters.to} onChange={submit} className="field py-2 text-sm" />
          </label>
        </div>
        {advancedCount > 0 && (
          <a href={`${action}${filters.view ? `?view=${filters.view}` : ""}`} className="mt-3 inline-block text-sm text-crimson underline-offset-4 hover:underline">
            Clear filters
          </a>
        )}
      </details>
    </form>
  );
}

function Select({ name, label, value, options, onChange }: { name: string; label: string; value?: string; options: [string, string][]; onChange: () => void }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <select name={name} defaultValue={value ?? ""} onChange={onChange} className="field py-2 text-sm">
        {options.map(([v, l]) => (
          <option key={v} value={v}>{l}</option>
        ))}
      </select>
    </label>
  );
}
