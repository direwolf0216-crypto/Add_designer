"use client";

import type { DetailsJob } from "@/lib/jobs/resolveJobFields";
import type { TeamUser } from "./useJob";

/**
 * EXTENSION POINT — assignees avatar stack in the job details header (before the status badge).
 * Renders nothing for now. `teamUsers` is the /api/users list already loaded by useJob, for
 * resolving assignee ids to names/avatars.
 */
export default function JobAssignees(_props: { job: DetailsJob; teamUsers: TeamUser[] }) {
  return null;
}
