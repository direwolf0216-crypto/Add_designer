"use client";

import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Avatar } from "@/features/jobs/assignees/AssigneeAvatars";
import { AssigneeList, useAssignableUsers } from "@/features/jobs/assignees/AssigneePicker";

/** "Assigned to" chips + picker for one job entry in the form. */
export default function EntryAssigneePicker({ value, onChange, hint }: { value: string[]; onChange: (ids: string[]) => void; hint?: string }) {
  const users = useAssignableUsers();
  const [open, setOpen] = useState(false);
  const selected = value.map((id) => users.find((u) => u.id === id)).filter((u): u is NonNullable<typeof u> => Boolean(u));
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);

  return (
    <div className="flex flex-col gap-1.5 md:col-span-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <label className="whitespace-nowrap text-[0.75rem] font-bold text-slate-600 uppercase tracking-[0.5px]">Assigned to</label>
        {hint && <span className="text-[11px] leading-snug text-slate-400">{hint}</span>}
      </div>
      <div className="flex min-h-[45px] flex-wrap items-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-3 py-2">
        {selected.map((u) => (
          <span key={u.id} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pl-1 pr-2 text-xs font-bold text-slate-700 shadow-sm">
            <Avatar name={u.name} image={u.image} size={22} ring={false} />
            {u.name}
            <button type="button" onClick={() => toggle(u.id)} aria-label={`Remove ${u.name}`} className="flex h-4 w-4 items-center justify-center rounded-full text-slate-400 hover:bg-rose-50 hover:text-rose-500">
              <i className="ph-bold ph-x text-[10px]" aria-hidden="true"></i>
            </button>
          </span>
        ))}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-500 transition-colors hover:border-orange-300 hover:text-orange-600">
            <i className="ph-bold ph-user-plus" aria-hidden="true"></i>
            {selected.length ? "Add people" : "Assign people"}
          </PopoverTrigger>
          <PopoverContent align="start" className="!w-80 !rounded-2xl !p-3 !shadow-[0_24px_60px_-16px_rgba(15,23,42,0.35)]">
            <AssigneeList users={users} selected={value} onToggle={toggle} />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
