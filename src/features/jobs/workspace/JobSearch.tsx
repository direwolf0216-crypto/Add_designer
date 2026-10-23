"use client";

import { useEffect, useRef, useState } from "react";
import type { WorkspaceData } from "@/lib/jobs/workspace";
import { useWorkspaceUrl } from "./url";

/**
 * Job search as an icon button beside New job: hovering slides "Search" out, clicking opens it into a
 * search box (eased width). It stays open while it holds a search, closes when left empty or on Esc,
 * and updates the jobs (URL-backed) a moment after typing stops.
 */
export default function JobSearch({ data }: { data: WorkspaceData }) {
  const { update } = useWorkspaceUrl();
  const { params } = data;
  const [q, setQ] = useState(params.q);
  const [lastQ, setLastQ] = useState(params.q);
  if (lastQ !== params.q) {
    setLastQ(params.q);
    setQ(params.q);
  }
  useEffect(() => {
    if (q === params.q) return;
    const t = setTimeout(() => update({ q: q.trim() || null, more: null }), 300);
    return () => clearTimeout(t);
  }, [q, params.q, update]);

  const [open, setOpen] = useState(Boolean(params.q));
  const expanded = open || q !== "";
  const input = useRef<HTMLInputElement>(null);

  return (
    <div
      className={`group relative h-10 shrink-0 overflow-hidden rounded-xl border bg-white shadow-sm transition-[width,border-color,box-shadow] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
        expanded ? "w-[min(62vw,16rem)] border-orange-200 ring-4 ring-orange-500/10" : "w-10 border-slate-200 hover:w-[6.5rem] focus-within:w-[6.5rem]"
      }`}
    >
      <button
        type="button"
        aria-label="Search jobs"
        aria-expanded={expanded}
        onClick={() => {
          setOpen(true);
          requestAnimationFrame(() => input.current?.focus());
        }}
        className={`absolute inset-y-0 left-0 flex items-center gap-2 pl-3 pr-3 text-sm font-bold text-slate-700 focus-visible:outline-none ${expanded ? "pointer-events-none" : ""}`}
      >
        <i className="ph-bold ph-magnifying-glass text-[16px]" aria-hidden="true"></i>
        <span className={`whitespace-nowrap transition-opacity duration-300 ${expanded ? "opacity-0" : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"}`}>Search</span>
      </button>
      <input
        ref={input}
        type="search"
        value={q}
        tabIndex={expanded ? 0 : -1}
        aria-label="Search within jobs"
        placeholder="Job #, client, phone…"
        onChange={(e) => setQ(e.target.value)}
        onBlur={() => {
          if (!q.trim()) setOpen(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setQ("");
            setOpen(false);
            input.current?.blur();
          }
        }}
        className={`h-full w-full bg-transparent pl-9 pr-8 text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none [&::-webkit-search-cancel-button]:hidden ${expanded ? "opacity-100" : "pointer-events-none opacity-0"} transition-opacity duration-200`}
      />
      {q && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => {
            setQ("");
            input.current?.focus();
          }}
          className="absolute inset-y-0 right-1.5 my-auto flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          <i className="ph-bold ph-x text-xs" aria-hidden="true"></i>
        </button>
      )}
    </div>
  );
}
