"use client";

import useSWR from "swr";
import { asList, fetcher } from "@/lib/swr";
import type { FormLayout } from "@/lib/forms/types";
import { normalizeJob, type DetailsJob } from "@/lib/jobs/resolveJobFields";

export interface TeamUser {
  id: string;
  name?: string | null;
  image?: string | null;
  role?: string;
}

/** The job shown in the details view plus the JOB_FORM layout and team list used to render it. */
export function useJob(jobId: string | null | undefined, isVisible: boolean) {
  const { data: fetchedJob, mutate: refreshJob } = useSWR<Record<string, any>>(isVisible && jobId ? `/api/jobs/${jobId}` : null, fetcher);
  const { data: layoutRes } = useSWR<{ schema?: FormLayout }>(isVisible ? "/api/settings/layouts/JOB_FORM" : null, fetcher);
  // Not rendered yet; loaded for header extensions such as an assignees avatar stack.
  const { data: usersRes } = useSWR(isVisible ? "/api/users" : null, fetcher);

  const job: DetailsJob | null = jobId && fetchedJob ? normalizeJob(fetchedJob) : null;
  const layoutSchema: FormLayout | null = layoutRes?.schema ?? null;
  const teamUsers = asList<TeamUser>(usersRes);

  return { job, refreshJob, layoutSchema, teamUsers };
}
