"use client";

import { mutate } from "swr";
import type { DetailsJob } from "@/lib/jobs/resolveJobFields";
import AssigneePicker from "@/features/jobs/assignees/AssigneePicker";
import type { JobAssignee } from "@/features/jobs/assignees/types";
import type { TeamUser } from "./useJob";

/** Assignee avatars in the job details header; opens the assign popover for users with edit_jobs. */
export default function JobAssignees({ job }: { job: DetailsJob; teamUsers: TeamUser[] }) {
  const assignees = ((job as { assignments?: JobAssignee[] }).assignments ?? []) as JobAssignee[];
  return (
    <AssigneePicker
      jobId={job.id}
      assignees={assignees}
      onSaved={(next) => mutate(`/api/jobs/${job.id}`, (current: unknown) => (current ? { ...(current as object), assignments: next } : current), { revalidate: true })}
    />
  );
}
