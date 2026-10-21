"use client";

import { useState } from "react";
import { toast } from "sonner";
import { setJobPriorityAction } from "@/app/actions";
import { isPriority, PRIORITY_STYLE, type Priority } from "@/lib/jobs/priority";
import PriorityPicker from "@/features/jobs/workspace/PriorityPicker";

/** The job's queue priority: a picker for people who manage jobs, a chip (unless Normal) for everyone else. */
export default function JobPriority({ jobId, priority, canEdit, onChanged }: { jobId: string; priority: unknown; canEdit: boolean; onChanged: () => void }) {
  const [value, setValue] = useState<Priority>(isPriority(priority) ? priority : "NORMAL");
  const [busy, setBusy] = useState(false);
  const [synced, setSynced] = useState(priority);
  if (priority !== synced) {
    setSynced(priority);
    if (isPriority(priority)) setValue(priority);
  }

  if (!canEdit) {
    if (value === "NORMAL") return null;
    const s = PRIORITY_STYLE[value];
    return (
      <span className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold" style={{ color: s.hex, backgroundColor: `${s.hex}12` }}>
        <i className={`ph-bold ${s.icon}`} aria-hidden="true"></i>
        {s.label} priority
      </span>
    );
  }

  const change = async (next: Priority) => {
    if (next === value) return;
    const previous = value;
    setValue(next);
    setBusy(true);
    const res = await setJobPriorityAction(jobId, next);
    setBusy(false);
    if (!res.success) {
      setValue(previous);
      toast.error(res.error || "Couldn't change the priority");
      return;
    }
    toast.success(`Priority set to ${PRIORITY_STYLE[next].label}`);
    onChanged();
  };

  return <PriorityPicker value={value} onChange={change} compact disabled={busy} />;
}
