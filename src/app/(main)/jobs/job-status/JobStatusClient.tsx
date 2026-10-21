"use client";

import { useState } from "react";
import { useGlobalForm } from "@/components/providers/GlobalFormProvider";
import StatusSummaryCards from "@/features/jobs/status/StatusSummaryCards";
import JobStatusTable from "@/features/jobs/status/JobStatusTable";
import JobStatusDetailPanel from "@/features/jobs/status/JobStatusDetailPanel";
import DeleteJobDialog from "@/features/jobs/status/DeleteJobDialog";
import { JOB_STATUS_ITEMS_PER_PAGE, useJobStatusList } from "@/features/jobs/status/useJobStatusList";

interface JobStatusClientProps {
  jobs: any[];
  teamUsers?: any[];
  initialTab?: string;
}

export default function JobStatusClient({ jobs: initialJobs, teamUsers = [], initialTab = 'Pending' }: JobStatusClientProps) {
  const {
    jobs,
    layoutSchema,
    counts,
    activeTab,
    setActiveTab,
    filteredJobs,
    paginatedJobs,
    totalPages,
    currentPage,
    setCurrentPage,
    updateJob,
    deleteJob,
  } = useJobStatusList({ initialJobs, teamUsers, initialTab });

  const { openJobDetails, openJobForm } = useGlobalForm();
  // Nothing selects a row yet (rows open the global details modal), so the side panel stays hidden.
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const selectedJob = jobs.find(a => a.id === selectedJobId) || null;

  const confirmDelete = async () => {
    if (!deleteConfirmId) return;
    setIsDeleting(true);
    try {
      if (await deleteJob(deleteConfirmId)) setDeleteConfirmId(null);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="view-section active w-full fade-in-up">
      <div className="flex flex-col gap-6 max-w-[1400px] mx-auto pb-10">

        {/* Metrics Cards */}
        <StatusSummaryCards counts={counts} activeTab={activeTab} onSelect={setActiveTab} />

        {/* Main Content Split */}
        <div className="flex flex-col lg:flex-row gap-6 mt-2">

          {/* Left Column - List */}
          <JobStatusTable
            jobs={paginatedJobs}
            totalCount={filteredJobs.length}
            page={currentPage}
            totalPages={totalPages}
            perPage={JOB_STATUS_ITEMS_PER_PAGE}
            onPageChange={setCurrentPage}
            layoutSchema={layoutSchema}
            selectedJobId={selectedJobId}
            onOpenDetails={openJobDetails}
            onEdit={openJobForm}
            onDelete={setDeleteConfirmId}
          />

          {/* Right Column - Detail Panel */}
          {selectedJob && (
            <JobStatusDetailPanel
              job={selectedJob}
              teamUsers={teamUsers}
              onClose={() => setSelectedJobId(null)}
              onUpdate={updateJob}
              onViewDetails={() => {
                if (selectedJobId) openJobDetails(selectedJobId);
              }}
            />
          )}

        </div>
      </div>

      {deleteConfirmId && (
        <DeleteJobDialog isDeleting={isDeleting} onConfirm={confirmDelete} onCancel={() => setDeleteConfirmId(null)} />
      )}

    </div>
  );
}
