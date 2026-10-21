"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { asList, fetcher, invalidateJobs } from "@/lib/swr";
import { usePermissions } from "@/hooks/usePermissions";
import AssigneeAvatars, { Avatar } from "./AssigneeAvatars";
import type { JobAssignee } from "./types";

export type AssignableUser = { id: string; name: string; image?: string | null; role: string };

const ROLE_LABEL: Record<string, string> = { ADMIN: "Admin", STAFF: "Staff", DESIGNER: "Designer" };

/** Active team members for assignment pickers. */
export function useAssignableUsers(enabled = true): AssignableUser[] {
  const { data } = useSWR(enabled ? "/api/users" : null, fetcher, { revalidateOnFocus: false });
  return asList<{ id: string; name: string | null; image?: string | null; role: string; status?: string }>(data)
    .filter((u) => !u.status || u.status === "ACTIVE")
    .map((u) => ({ id: u.id, name: u.name || "Unknown", image: u.image, role: u.role }));
}

/** Searchable, multi-select list of team members. Controlled; used by the popover and the job form. */
export function AssigneeList({ users, selected, onToggle }: { users: AssignableUser[]; selected: string[]; onToggle: (id: string) => void }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? users.filter((u) => u.name.toLowerCase().includes(q)) : users;
  }, [users, query]);

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <i className="ph-bold ph-magnifying-glass pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400" aria-hidden="true"></i>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search team…"
          aria-label="Search team members"
          className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-orange-300 focus:bg-white focus:outline-none focus:ring-4 focus:ring-orange-500/10"
        />
      </div>
      <ul role="listbox" aria-multiselectable="true" className="max-h-64 overflow-y-auto pr-1">
        {filtered.length === 0 && <li className="px-2 py-6 text-center text-xs text-slate-400">No team members match.</li>}
        {filtered.map((u) => {
          const isOn = selected.includes(u.id);
          return (
            <li key={u.id}>
              <button
                type="button"
                role="option"
                aria-selected={isOn}
                onClick={() => onToggle(u.id)}
                className={`flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors ${isOn ? "bg-orange-50/80" : "hover:bg-slate-50"}`}
              >
                <Avatar name={u.name} image={u.image} size={30} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-slate-800">{u.name}</span>
                  <span className="text-[11px] font-semibold text-slate-400">{ROLE_LABEL[u.role] ?? u.role}</span>
                </span>
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-md border transition-colors ${isOn ? "border-orange-500 bg-orange-500 text-white" : "border-slate-300 bg-white"}`}
                  aria-hidden="true"
                >
                  {isOn && <i className="ph-bold ph-check text-[11px]"></i>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Avatar stack that opens a searchable assign popover for users with manage_jobs. Saves through
 * PUT /api/jobs/[id]/assignees and calls `onSaved` with the new assignments.
 */
export default function AssigneePicker({ jobId, assignees, onSaved }: { jobId: string; assignees: JobAssignee[]; onSaved?: (assignees: JobAssignee[]) => void }) {
  const { checkPermission } = usePermissions();
  const canAssign = checkPermission("manage_jobs");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const users = useAssignableUsers(open);

  if (!canAssign) return <AssigneeAvatars assignees={assignees} />;

  const current = assignees.map((a) => a.userId);
  const dirty = draft.length !== current.length || draft.some((id) => !current.includes(id));

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/assignees`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds: draft }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Couldn't update assignees");
      onSaved?.(data.assignments ?? []);
      invalidateJobs();
      toast.success("Assignees updated");
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't update assignees");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) setDraft(current);
        setOpen(next);
      }}
    >
      <PopoverTrigger
        className="group flex items-center gap-2 rounded-xl px-1.5 py-1 transition-colors hover:bg-slate-100/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
        aria-label="Change assignees"
      >
        <AssigneeAvatars assignees={assignees} />
        <span className="flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-slate-300 text-slate-400 transition-colors group-hover:border-orange-400 group-hover:text-orange-500">
          <i className="ph-bold ph-plus text-[11px]" aria-hidden="true"></i>
        </span>
      </PopoverTrigger>
      <PopoverContent align="start" className="!w-80 !rounded-2xl !p-3 !shadow-[0_24px_60px_-16px_rgba(15,23,42,0.35)]">
        <div className="mb-1 flex items-center justify-between px-1">
          <p className="text-xs font-extrabold uppercase tracking-wider text-slate-500">Assign to</p>
          {draft.length > 0 && (
            <button type="button" onClick={() => setDraft([])} className="text-[11px] font-bold text-slate-400 hover:text-rose-500">
              Clear
            </button>
          )}
        </div>
        <AssigneeList users={users} selected={draft} onToggle={(id) => setDraft((d) => (d.includes(id) ? d.filter((x) => x !== id) : [...d, id]))} />
        <div className="mt-1 flex items-center justify-between border-t border-slate-100 pt-3">
          <span className="text-[11px] font-semibold text-slate-400">{draft.length} selected</span>
          <button
            type="button"
            onClick={save}
            disabled={!dirty || saving}
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm transition-colors hover:bg-slate-800 disabled:opacity-40"
          >
            {saving ? <i className="ph-bold ph-circle-notch animate-spin" aria-hidden="true"></i> : <i className="ph-bold ph-check" aria-hidden="true"></i>}
            Save
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
