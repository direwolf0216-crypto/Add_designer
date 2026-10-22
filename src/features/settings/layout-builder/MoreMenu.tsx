"use client";

import { useEffect, useRef, useState } from "react";

export interface MoreMenuItem {
  label: string;
  hint?: string;
  icon: string;
  onSelect: () => void;
  tone?: "default" | "danger";
}

/** The header's overflow menu: export, import, templates, reset. */
export default function MoreMenu({ items }: { items: MoreMenuItem[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="More actions"
        title="Export, import, templates"
        className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
      >
        <i className="ph-bold ph-dots-three-outline-vertical text-lg"></i>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full mt-1.5 z-50 w-72 rounded-2xl border border-gray-200 bg-white p-1.5 shadow-xl animate-in fade-in slide-in-from-top-2">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              onClick={() => { setOpen(false); item.onSelect(); }}
              className={`w-full flex items-start gap-3 rounded-xl px-3 py-2 text-left transition-colors ${item.tone === "danger" ? "hover:bg-red-50" : "hover:bg-slate-50"}`}
            >
              <i className={`ph-bold ${item.icon} text-lg mt-0.5 ${item.tone === "danger" ? "text-red-500" : "text-slate-500"}`}></i>
              <span className="min-w-0">
                <span className={`block text-sm font-bold ${item.tone === "danger" ? "text-red-700" : "text-slate-800"}`}>{item.label}</span>
                {item.hint && <span className="block text-[0.7rem] text-slate-500 leading-snug">{item.hint}</span>}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
