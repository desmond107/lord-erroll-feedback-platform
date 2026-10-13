"use client";

import { useEffect, useRef, useState } from "react";

export default function ExportMenu({ query, label = "Export" }: { query: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);
  const sep = query ? "&" : "?";
  const items = [
    ["pdf", "PDF register"],
    ["xlsx", "Excel workbook"],
    ["csv", "CSV file"],
  ];
  return (
    <div ref={ref} className="relative">
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        ⤓ {label}
      </button>
      {open && (
        <div className="anim-fade card absolute right-0 z-20 mt-2 w-48 overflow-hidden p-1">
          {items.map(([f, l]) => (
            <a key={f} href={`/api/portal/export${query}${sep}format=${f}`} className="block rounded-md px-3 py-2 text-sm hover:bg-gold-soft" onClick={() => setOpen(false)}>
              {l}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
