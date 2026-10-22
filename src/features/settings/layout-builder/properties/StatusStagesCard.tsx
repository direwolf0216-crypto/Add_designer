"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/swr";
import type { FormField } from "@/lib/layout-builder/types";

type Team = { id: string; name: string; color: string; stages: string[]; stageLabels: Record<string, string> };

/** Which teams work each stage and what they call it (from Settings → Teams), shown beside the status options. */
export default function StatusStagesCard({ field }: { field: FormField }) {
  const { data } = useSWR<{ teams: Team[] }>("/api/teams", fetcher, { revalidateOnFocus: false });
  const teams = data?.teams ?? [];
  const stages = (field.statusOptions ?? []).map((o) => o.label);
  if (stages.length === 0) return null;
  const lower = (s: string) => s.trim().toLowerCase();

  return (
    <div className="pt-4 border-t border-gray-100">
      <div className="flex items-center justify-between mb-2">
        <label className="text-[0.75rem] font-bold text-slate-600">Teams on each stage</label>
        <a href="/settings?section=teams" className="text-[0.7rem] font-bold text-orange-600 hover:text-orange-700">Open Teams</a>
      </div>
      {teams.length === 0 ? (
        <p className="text-[0.75rem] text-slate-500 leading-snug">No teams yet. Teams pick the stages they work and can show each one under their own name in My Jobs.</p>
      ) : (
        <ul className="space-y-1">
          {stages.map((stage) => {
            const owners = teams.filter((t) => t.stages.some((s) => lower(s) === lower(stage)));
            return (
              <li key={stage} className="flex items-start gap-2 rounded-xl border border-gray-200 bg-white px-2.5 py-1.5">
                <span className="min-w-0 w-28 shrink-0 truncate text-[0.78rem] font-bold text-slate-700" title={stage}>{stage}</span>
                <div className="flex flex-wrap gap-1 min-w-0">
                  {owners.length === 0 ? (
                    <span className="text-[0.7rem] text-slate-400">no team</span>
                  ) : owners.map((t) => {
                    const key = Object.keys(t.stageLabels).find((k) => lower(k) === lower(stage));
                    const alias = key ? t.stageLabels[key] : "";
                    return (
                      <span key={t.id} className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[0.68rem] font-bold" style={{ borderColor: t.color, color: t.color }} title={alias ? `${t.name} shows this stage as “${alias}”` : t.name}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: t.color }}></span>
                        {t.name}{alias && alias.toLowerCase() !== lower(stage) ? <span className="font-semibold opacity-80">“{alias}”</span> : null}
                      </span>
                    );
                  })}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
