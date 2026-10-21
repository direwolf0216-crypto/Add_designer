"use client";

import { useState } from "react";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { fetcher } from "@/lib/swr";
import type { RoleSummary } from "@/lib/services/roles";

export const roleIcon = (r: Pick<RoleSummary, "key" | "kind">) =>
  r.key === "OWNER" ? "ph-crown-simple" : r.key === "ADMIN" ? "ph-shield-check" : r.key === "STAFF" ? "ph-users" : "ph-identification-badge";

export function useRoles() {
  const { data, mutate, isLoading } = useSWR<{ roles: RoleSummary[] }>("/api/roles", fetcher, { revalidateOnFocus: false });
  return { roles: data?.roles ?? [], mutate, isLoading };
}

/**
 * Role picker for inviting/editing people. Lists Admin (owner only), Staff and every custom role.
 * `value` is a role key ("ADMIN" | "STAFF" | "custom:<id>").
 */
export default function RoleSelect({ value, onChange, disabled, fallbackLabel }: { value: string; onChange: (key: string) => void; disabled?: boolean; fallbackLabel?: string }) {
  const { roles } = useRoles();
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const isOwner = session?.user?.role === "OWNER";
  const options = roles.filter((r) => r.key !== "OWNER" && (r.key !== "ADMIN" || isOwner || value === "ADMIN"));
  const current = roles.find((r) => r.key === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        disabled={disabled}
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-left text-sm shadow-sm transition-all hover:border-orange-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/20 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
      >
        <span className="flex min-w-0 items-center gap-2 font-medium">
          {current && <i className={`ph-bold ${roleIcon(current)} text-slate-400`} aria-hidden="true"></i>}
          <span className="truncate">{current?.name ?? fallbackLabel ?? "Choose a role"}</span>
        </span>
        {!disabled && <i className="ph-bold ph-caret-down text-xs text-slate-400" aria-hidden="true"></i>}
      </PopoverTrigger>
      <PopoverContent align="start" className="!w-[min(92vw,300px)] !gap-0 !rounded-2xl !p-1.5">
        <ul role="listbox" className="max-h-72 overflow-y-auto">
          {options.map((r) => {
            const on = r.key === value;
            return (
              <li key={r.key}>
                <button
                  type="button"
                  role="option"
                  aria-selected={on}
                  onClick={() => {
                    onChange(r.key);
                    setOpen(false);
                  }}
                  className={`flex w-full items-start gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors ${on ? "bg-orange-50/80" : "hover:bg-slate-50"}`}
                >
                  <i className={`ph-bold ${roleIcon(r)} mt-0.5 text-[15px] ${on ? "text-orange-500" : "text-slate-400"}`} aria-hidden="true"></i>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-slate-800">{r.name}</span>
                    <span className="block truncate text-[11px] font-medium text-slate-400">
                      {r.locked ? "Full access" : `${r.permissions.length} permission${r.permissions.length === 1 ? "" : "s"}`}
                      {r.description ? ` · ${r.description}` : ""}
                    </span>
                  </span>
                  {on && <i className="ph-bold ph-check mt-1 text-xs text-orange-500" aria-hidden="true"></i>}
                </button>
              </li>
            );
          })}
          {options.length === 0 && <li className="px-3 py-5 text-center text-xs text-slate-400">Loading roles…</li>}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
