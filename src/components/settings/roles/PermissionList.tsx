"use client";

import { PERMISSION_GROUPS, PERMISSION_INFO, type Permission } from "@/lib/permissions";

function Switch({ on, disabled }: { on: boolean; disabled?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${on ? "bg-orange-500" : "bg-slate-200"} ${disabled ? "opacity-60" : ""}`}
    >
      <span className={`h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${on ? "translate-x-[18px]" : "translate-x-0.5"}`} />
    </span>
  );
}

/** Grouped permission switches. Read-only when `onToggle` is omitted. */
export default function PermissionList({ granted, onToggle }: { granted: readonly Permission[]; onToggle?: (p: Permission) => void }) {
  return (
    <div className="flex flex-col gap-5">
      {PERMISSION_GROUPS.map((group) => (
        <section key={group.title}>
          <h4 className="mb-1.5 px-1 text-[0.65rem] font-extrabold uppercase tracking-wider text-slate-400">{group.title}</h4>
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
            {group.permissions.map((p) => {
              const info = PERMISSION_INFO[p];
              const on = granted.includes(p);
              return (
                <li key={p}>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={on}
                    disabled={!onToggle}
                    onClick={() => onToggle?.(p)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors enabled:hover:bg-slate-50/80 disabled:cursor-default"
                  >
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${on ? "bg-orange-50 text-orange-500" : "bg-slate-50 text-slate-400"}`}>
                      <i className={`ph-bold ${info.icon} text-[15px]`} aria-hidden="true"></i>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-slate-800">{info.label}</span>
                      <span className="block text-xs text-slate-500">{info.description}</span>
                    </span>
                    <Switch on={on} disabled={!onToggle} />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
