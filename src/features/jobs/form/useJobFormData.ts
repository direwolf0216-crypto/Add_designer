"use client";

import { useState } from "react";
import useSWR from "swr";
import { asList, fetcher } from "@/lib/swr";
import type { FormLayout } from "@/lib/forms/types";
import type { JobRecord } from "@/lib/jobs/formMapping";
import type { AvailabilityJob } from "@/lib/jobs/availability";
import type { UserItem } from "@/components/ui/MultiUserPicklist";

/** `value` while defined, otherwise the last defined value seen (latched during render). */
function useLastLoaded<T>(value: T | undefined): T | undefined {
  const [last, setLast] = useState(value);
  if (value !== undefined && value !== last) setLast(value);
  return value !== undefined ? value : last;
}

export interface JobFormDataArgs {
  isOpen: boolean;
  jobToEditId: string | null;
  /** The form's current date (yyyy-MM-dd); loads that day's jobs for staff availability. */
  date: string | undefined;
}

/** Remote data the job form needs: the job being edited, the layout, staff and Drive status. */
export function useJobFormData({ isOpen, jobToEditId, date }: JobFormDataArgs) {
  const { data: fetchedJob, isLoading: isJobLoading } = useSWR<JobRecord>(jobToEditId ? `/api/jobs/${jobToEditId}` : null, fetcher);
  const job = jobToEditId ? fetchedJob ?? null : null;

  const { data: layoutData } = useSWR<{ schema?: FormLayout }>(isOpen ? "/api/settings/layouts/JOB_FORM" : null, fetcher);
  const { data: usersData } = useSWR(isOpen ? "/api/users" : null, fetcher);
  const { data: driveStatus } = useSWR<{ connected: boolean }>(isOpen ? "/api/integrations/google" : null, fetcher);
  const { data: jobsData } = useSWR<{ items?: AvailabilityJob[] }>(
    isOpen && date ? `/api/jobs?startDate=${date}&endDate=${date}` : null,
    fetcher
  );

  // The last loaded values stay on screen while the dialog closes and the SWR keys switch to null.
  const layoutSchema = useLastLoaded(layoutData?.schema?.sections ? layoutData.schema : undefined) ?? null;
  const loadedUsers = useLastLoaded(usersData);
  const teamUsers: UserItem[] = loadedUsers
    ? asList<{ id: string; name?: string; image?: string | null; role: string; roleKey?: string; roleName?: string }>(loadedUsers)
        .map((u) => ({ id: u.id, name: u.name || "Unknown", image: u.image, role: u.role, roleKey: u.roleKey, roleName: u.roleName }))
    : [];
  const allJobs: AvailabilityJob[] = useLastLoaded(jobsData)?.items || [];

  return { job, isJobLoading, layoutSchema, teamUsers, allJobs, driveStatus };
}
