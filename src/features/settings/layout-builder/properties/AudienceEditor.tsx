"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/swr";
import { AUDIENCE_PREFIX } from "@/lib/forms/audience";
import type { FieldAudience } from "@/lib/layout-builder/types";
import type { FieldEditorProps } from "./types";

type RoleRow = { key: string; kind: "system" | "custom"; id: string; name: string };
type TeamRow = { id: string; name: string; color: string };

/** Who sees or may edit the field: roles and teams, as chips. Admins always see everything. */
export default function AudienceEditor({ field, onChange }: FieldEditorProps) {
  const { data: rolesData } = useSWR<{ roles: RoleRow[] }>("/api/roles", fetcher, { revalidateOnFocus: false });
  const { data: teamsData } = useSWR<{ teams: TeamRow[] }>("/api/teams", fetcher, { revalidateOnFocus: false });
  const roles = (rolesData?.roles ?? []).filter((r) => r.key !== "ADMIN");
  const teams = teamsData?.teams ?? [];
  const audience: FieldAudience = field.audience ?? {};

  const options = [
    ...roles.map((r) => ({ token: r.kind === "custom" ? `${AUDIENCE_PREFIX.custom}${r.id}` : `${AUDIENCE_PREFIX.role}${r.key}`, label: r.name, group: "role" as const })),
    ...teams.map((t) => ({ token: `${AUDIENCE_PREFIX.team}${t.id}`, label: t.name, group: "team" as const, color: t.color })),
  ];

  const toggle = (list: "hideFor" | "readOnlyFor", token: string) => {
    const current = audience[list] ?? [];
    const next = current.includes(token) ? current.filter((t) => t !== token) : [...current, token];
    const other: "hideFor" | "readOnlyFor" = list === "hideFor" ? "readOnlyFor" : "hideFor";
    // Hidden and read-only are exclusive for the same audience.
    const otherList = (audience[other] ?? []).filter((t) => t !== token);
    const merged: FieldAudience = { ...audience, [list]: next, [other]: otherList };
    const cleaned: FieldAudience = {};
    if (merged.hideFor?.length) cleaned.hideFor = merged.hideFor;
    if (merged.readOnlyFor?.length) cleaned.readOnlyFor = merged.readOnlyFor;
    onChange({ audience: Object.keys(cleaned).length ? cleaned : undefined });
  };

  const chipRow = (list: "hideFor" | "readOnlyFor") => (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = (audience[list] ?? []).includes(o.token);
        return (
          <button
            key={o.token}
            type="button"
            onClick={() => toggle(list, o.token)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[0.72rem] font-bold transition-colors ${
              on ? (list === "hideFor" ? "border-red-300 bg-red-50 text-red-700" : "border-amber-300 bg-amber-50 text-amber-800") : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
            }`}
          >
            {o.group === "team" ? <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: o.color }}></span> : <i className="ph-bold ph-user text-[0.65rem]"></i>}
            {o.label}
          </button>
        );
      })}
      {options.length === 0 && <span className="text-[0.72rem] text-slate-400">Loading roles and teams…</span>}
    </div>
  );

  return (
    <div className="border-t border-gray-100 pt-4">
      <label className="text-[0.75rem] font-bold text-slate-600 mb-1 block">Who sees this field</label>
      <p className="text-[0.7rem] text-slate-500 leading-snug mb-3">Admins always see and edit everything. Values saved under a hidden field stay in the record.</p>
      <span className="text-[0.65rem] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1"><i className="ph-bold ph-eye-slash text-red-500"></i> Hidden for</span>
      {chipRow("hideFor")}
      <span className="text-[0.65rem] font-bold text-slate-500 uppercase tracking-wider mt-3 mb-1.5 flex items-center gap-1"><i className="ph-bold ph-lock-simple text-amber-600"></i> Read-only for</span>
      {chipRow("readOnlyFor")}
    </div>
  );
}
