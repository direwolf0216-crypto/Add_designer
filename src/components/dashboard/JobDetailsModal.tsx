// The job details view now lives in src/features/jobs/details/. Kept as the import path used by
// src/app/(main)/jobs/details/[id]/page.tsx (`<JobDetailsModal standaloneJobId={id} />`).
export { default } from "@/features/jobs/details/JobDetailsView";
export type { JobDetailsViewProps, JobDetailsTab } from "@/features/jobs/details/JobDetailsView";
