"use client";

import type { JobAssignee } from "./types";

const GRADIENTS = [
  "from-orange-500 to-pink-500",
  "from-sky-500 to-indigo-500",
  "from-emerald-500 to-teal-500",
  "from-violet-500 to-fuchsia-500",
  "from-amber-500 to-orange-600",
  "from-slate-700 to-slate-900",
];

function initials(name: string | null | undefined) {
  const parts = (name || "?").trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

function gradientFor(name: string | null | undefined) {
  let h = 0;
  for (const ch of name || "") h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return GRADIENTS[h % GRADIENTS.length];
}

export function Avatar({ name, image, size = 28, ring = true }: { name: string | null | undefined; image?: string | null; size?: number; ring?: boolean }) {
  return (
    <span
      style={{ width: size, height: size, fontSize: Math.max(9, Math.round(size * 0.36)) }}
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br font-extrabold text-white ${gradientFor(name)} ${ring ? "ring-2 ring-white" : ""}`}
    >
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element -- avatar URLs come from arbitrary hosts
        <img src={image} alt="" className="h-full w-full object-cover" />
      ) : (
        initials(name)
      )}
    </span>
  );
}

/** Compact stack of assignee avatars; "Unassigned" when empty. */
export default function AssigneeAvatars({ assignees, max = 3, size = 28 }: { assignees: JobAssignee[]; max?: number; size?: number }) {
  if (assignees.length === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400">
        <i className="ph-bold ph-user-circle-dashed text-sm" aria-hidden="true"></i>
        Unassigned
      </span>
    );
  }
  const shown = assignees.slice(0, max);
  const extra = assignees.length - shown.length;
  const names = assignees.map((a) => a.user.name || "Unknown").join(", ");
  return (
    <span className="flex items-center" title={`Assigned to ${names}`} aria-label={`Assigned to ${names}`}>
      {shown.map((a, i) => (
        <span key={a.userId} style={{ marginLeft: i === 0 ? 0 : -8 }}>
          <Avatar name={a.user.name} image={a.user.image} size={size} />
        </span>
      ))}
      {extra > 0 && (
        <span
          style={{ width: size, height: size, marginLeft: -8 }}
          className="inline-flex items-center justify-center rounded-full bg-slate-100 text-[10px] font-extrabold text-slate-600 ring-2 ring-white"
        >
          +{extra}
        </span>
      )}
    </span>
  );
}
