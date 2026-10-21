"use client";

import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Avatar } from "@/features/jobs/assignees/AssigneeAvatars";
import { AssigneeList, useAssignableUsers } from "@/features/jobs/assignees/AssigneePicker";
import { usePermissions } from "@/hooks/usePermissions";
import { useJobFormContext } from "./JobFormContext";

/**
 * Job-form inputs that live outside the dynamic JOB_FORM layout: the "Assigned to" picker.
 * The selection is form state (useJobFormState) and is submitted with the single saveJobAction call.
 */
export default function JobFormExtras() {
  const { assigneeIds, setAssigneeIds, job } = useJobFormContext();
  const { checkPermission } = usePermissions();
  const seesAllJobs = checkPermission("view_all_jobs");
  const users = useAssignableUsers();
  const [open, setOpen] = useState(false);

  const selected = assigneeIds
    .map((id) => users.find((u) => u.id === id))
    .filter((u): u is NonNullable<typeof u> => Boolean(u));
  const toggle = (id: string) => setAssigneeIds(assigneeIds.includes(id) ? assigneeIds.filter((x) => x !== id) : [...assigneeIds, id]);

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white to-slate-50/60 p-4 shadow-sm" aria-labelledby="job-assignees-title">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-orange-50 text-orange-600 ring-1 ring-orange-100">
          <i className="ph-bold ph-users-three text-base" aria-hidden="true"></i>
        </span>
        <div>
          <h3 id="job-assignees-title" className="text-sm font-extrabold text-slate-900">Assigned to</h3>
          <p className="text-[11px] text-slate-500">
            {!job && !seesAllJobs ? "You'll be assigned automatically. Add teammates if needed." : "Assigned people see this job in My Jobs and get notified."}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {selected.map((u) => (
          <span key={u.id} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pl-1 pr-2 text-xs font-bold text-slate-700 shadow-sm">
            <Avatar name={u.name} image={u.image} size={22} ring={false} />
            {u.name}
            <button
              type="button"
              onClick={() => toggle(u.id)}
              aria-label={`Remove ${u.name}`}
              className="flex h-4 w-4 items-center justify-center rounded-full text-slate-400 hover:bg-rose-50 hover:text-rose-500"
            >
              <i className="ph-bold ph-x text-[10px]" aria-hidden="true"></i>
            </button>
          </span>
        ))}

        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-500 transition-colors hover:border-orange-400 hover:text-orange-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400">
            <i className="ph-bold ph-user-plus" aria-hidden="true"></i>
            {selected.length ? "Add people" : "Assign people"}
          </PopoverTrigger>
          <PopoverContent align="start" className="!w-80 !rounded-2xl !p-3 !shadow-[0_24px_60px_-16px_rgba(15,23,42,0.35)]">
            <AssigneeList users={users} selected={assigneeIds} onToggle={toggle} />
          </PopoverContent>
        </Popover>
      </div>
    </section>
  );
}
