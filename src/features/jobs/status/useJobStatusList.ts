"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { toast } from "sonner";
import { fetcher, invalidateJobs } from "@/lib/swr";
import { deleteJobAction, updateJobTrackingAction } from "@/app/actions";
import {
  applyJobTrackingUpdate,
  countJobsByStatus,
  filterJobsForStatusBoard,
  paginate,
  type JobTrackingUpdate,
  type StatusBoardJob,
  type StatusBoardUser,
} from "@/lib/jobs/statusCounts";
import type { JobLayoutSchema } from "@/lib/jobs/statusRow";

export const JOB_STATUS_ITEMS_PER_PAGE = 25;

interface UseJobStatusListOptions {
  initialJobs: StatusBoardJob[];
  teamUsers: StatusBoardUser[];
  initialTab: string;
}

/**
 * Local job list for the status board: mirrors the server-provided jobs (resetting when the page
 * re-renders with new ones), tab/search/page state, and tracking updates applied optimistically
 * with rollback on failure.
 */
export function useJobStatusList({ initialJobs, teamUsers, initialTab }: UseJobStatusListOptions) {
  const router = useRouter();
  const [jobs, setJobs] = useState(initialJobs);

  const [prevInitialJobs, setPrevInitialJobs] = useState(initialJobs);
  if (initialJobs !== prevInitialJobs) {
    setPrevInitialJobs(initialJobs);
    setJobs(initialJobs);
  }

  const { data: layoutData } = useSWR<{ schema?: JobLayoutSchema }>("/api/settings/layouts/JOB_FORM", fetcher);
  const layoutSchema = layoutData?.schema;

  const [activeTab, setActiveTab] = useState<string>(initialTab);
  // No search box is rendered yet; the filter honours this once a toolbar sets it.
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const counts = useMemo(() => countJobsByStatus(jobs), [jobs]);

  const filteredJobs = filterJobsForStatusBoard(jobs, { tab: activeTab, searchQuery, teamUsers });
  const { items: paginatedJobs, totalPages, page: safeCurrentPage } = paginate(filteredJobs, currentPage, JOB_STATUS_ITEMS_PER_PAGE);

  const updateJob = async (jobId: string, updates: JobTrackingUpdate) => {
    const previousJobs = jobs;
    // Optimistic update (rolled back below if the save fails)
    setJobs(prev => prev.map(a => (a.id === jobId ? applyJobTrackingUpdate(a, updates) : a)));

    const res = await updateJobTrackingAction(jobId, updates);
    if (!res.success) {
      toast.error(res.error || "Failed to update job");
      setJobs(previousJobs);
    } else {
      toast.success("Job updated");
      invalidateJobs();
      router.refresh();
    }
  };

  /** Moves a job to the recycle bin; resolves true on success. */
  const deleteJob = async (jobId: string): Promise<boolean> => {
    const res = await deleteJobAction(jobId);
    if (!res.success) {
      toast.error(res.error || "Failed to delete job");
      return false;
    }
    toast.success("Job moved to the recycle bin");
    invalidateJobs();
    router.refresh();
    return true;
  };

  return {
    jobs,
    layoutSchema,
    counts,
    activeTab,
    setActiveTab,
    searchQuery,
    setSearchQuery,
    filteredJobs,
    paginatedJobs,
    totalPages,
    currentPage: safeCurrentPage,
    setCurrentPage,
    updateJob,
    deleteJob,
  };
}
