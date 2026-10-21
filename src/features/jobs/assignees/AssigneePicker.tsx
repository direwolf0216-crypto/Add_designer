"use client";

import { useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import MultiUserPicklist, { type UserItem } from "@/components/ui/MultiUserPicklist";
import { asList, fetcher, invalidateJobs } from "@/lib/swr";
import { usePermissions } from "@/hooks/usePermissions";
import AssigneeAvatars from "./AssigneeAvatars";
import type { JobAssignee } from "./types";

/** Active team members for assignment pickers. */
export function useAssignableUsers(enabled = true): UserItem[] {
  const { data } = useSWR(enabled ? "/api/users" : null, fetcher, { revalidateOnFocus: false });
  return asList<{ id: string; name: string | null; image?: string | null; role: string; status?: string }>(data)
    .filter((u) => !u.status || u.status === "ACTIVE")
    .map((u) => ({ id: u.id, name: u.name || "Unknown", image: u.image, role: u.role }));
}

/**
 * Avatar stack that turns into an inline picker for users with manage_jobs. Saves immediately through
 * PUT /api/jobs/[id]/assignees and calls `onSaved` with the new assignments.
 */
export default function AssigneePicker({
  jobId,
  assignees,
  onSaved,
}: {
  jobId: string;
  assignees: JobAssignee[];
  onSaved?: (assignees: JobAssignee[]) => void;
}) {
  const { checkPermission } = usePermissions();
  const canAssign = checkPermission("manage_jobs");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const users = useAssignableUsers(editing);

  if (!canAssign) return <AssigneeAvatars assignees={assignees} />;

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-slate-50"
        aria-label="Change assignees"
      >
        <AssigneeAvatars assignees={assignees} />
        <i className="ph-bold ph-user-plus text-sm text-slate-400" aria-hidden="true"></i>
      </button>
    );
  }

  const save = async (value: string) => {
    const userIds = value.split(",").map((s) => s.trim()).filter(Boolean);
    setSaving(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/assignees`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Couldn't update assignees");
      onSaved?.(data.assignments ?? []);
      invalidateJobs();
      toast.success("Assignees updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't update assignees");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-w-[240px] items-center gap-2">
      <div className={`flex-1 ${saving ? "pointer-events-none opacity-60" : ""}`}>
        <MultiUserPicklist
          users={users}
          value={assignees.map((a) => a.userId).join(",")}
          onChange={save}
          placeholder="Assign team members…"
        />
      </div>
      <button type="button" onClick={() => setEditing(false)} className="text-xs font-bold text-slate-500 hover:text-slate-800">
        Done
      </button>
    </div>
  );
}
