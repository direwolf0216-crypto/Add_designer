"use client";

import { useSession } from "next-auth/react";
import JobDetailsView, { type JobDetailsViewProps } from "./JobDetailsView";
import JobActivityFeed from "@/features/jobs/activity/JobActivityFeed";

const ACTIVITY_TAB = {
  id: "activity",
  label: "Activity",
  render: (jobId: string) => (
    <div className="mx-auto w-full max-w-3xl py-2">
      <JobActivityFeed jobId={jobId} />
    </div>
  ),
};

/** Job details with the admin-only Activity tab (the activity API is admin-only as well). */
export default function JobDetailsWithActivity(props: JobDetailsViewProps) {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";
  return <JobDetailsView {...props} extraTabs={isAdmin ? [ACTIVITY_TAB, ...(props.extraTabs ?? [])] : props.extraTabs} />;
}
