"use client";

import type { JobAssignee } from "./types";

function initials(name: string | null | undefined) {
  const parts = (name || "?").trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

/** Compact stack of assignee avatars; "Unassigned" when empty. */
export default function AssigneeAvatars({ assignees, max = 3, size = 28 }: { assignees: JobAssignee[]; max?: number; size?: number }) {
  if (assignees.length === 0) {
    return <span className="text-xs font-semibold text-slate-400">Unassigned</span>;
  }
  const shown = assignees.slice(0, max);
  const extra = assignees.length - shown.length;
  const names = assignees.map((a) => a.user.name || "Unknown").join(", ");
  return (
    <div className="flex items-center" title={`Assigned to ${names}`} aria-label={`Assigned to ${names}`}>
      {shown.map((a, i) => (
        <span
          key={a.userId}
          style={{ width: size, height: size, marginLeft: i === 0 ? 0 : -8 }}
          className="inline-flex items-center justify-center overflow-hidden rounded-full border-2 border-white bg-slate-900 text-[10px] font-bold text-white"
        >
          {a.user.image ? (
            // eslint-disable-next-line @next/next/no-img-element -- remote avatar URLs of unknown hosts
            <img src={a.user.image} alt="" className="h-full w-full object-cover" />
          ) : (
            initials(a.user.name)
          )}
        </span>
      ))}
      {extra > 0 && (
        <span
          style={{ width: size, height: size, marginLeft: -8 }}
          className="inline-flex items-center justify-center rounded-full border-2 border-white bg-slate-200 text-[10px] font-bold text-slate-700"
        >
          +{extra}
        </span>
      )}
    </div>
  );
}
