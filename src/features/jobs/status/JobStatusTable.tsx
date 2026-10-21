"use client";

import type { StatusBoardJob } from "@/lib/jobs/statusCounts";
import type { JobLayoutSchema } from "@/lib/jobs/statusRow";
import JobStatusRow, { type JobStatusRowProps } from "./JobStatusRow";
import JobStatusPagination from "./JobStatusPagination";

const TH = "p-5 text-[0.7rem] font-black text-slate-500 uppercase tracking-widest";

interface JobStatusTableProps {
  /** Jobs on the current page. */
  jobs: StatusBoardJob[];
  /** Number of jobs matching the active tab/search, across all pages. */
  totalCount: number;
  page: number;
  totalPages: number;
  perPage: number;
  onPageChange: (updater: (prev: number) => number) => void;
  layoutSchema: JobLayoutSchema | null | undefined;
  selectedJobId: string | null;
  onOpenDetails: (jobId: string) => void;
  onEdit: (jobId: string) => void;
  onDelete: (jobId: string) => void;
  renderAssignees?: JobStatusRowProps["renderAssignees"];
}

export default function JobStatusTable({
  jobs,
  totalCount,
  page,
  totalPages,
  perPage,
  onPageChange,
  layoutSchema,
  selectedJobId,
  onOpenDetails,
  onEdit,
  onDelete,
  renderAssignees,
}: JobStatusTableProps) {
  return (
    <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
      {totalCount > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className={`${TH} whitespace-nowrap`}><i className="ph ph-user mr-2 text-slate-400"></i> CUSTOMER</th>
                <th className={`${TH} whitespace-nowrap`}><i className="ph ph-tag mr-2 text-slate-400"></i> JOB ID</th>
                <th className={`${TH} whitespace-nowrap`}><i className="ph ph-folder mr-2 text-slate-400"></i> CATEGORY</th>
                <th className={`${TH} whitespace-nowrap`}><i className="ph ph-package mr-2 text-slate-400"></i> SIZE / QUANTITY</th>
                <th className={`${TH} whitespace-nowrap text-center`}><i className="ph ph-calendar mr-2 text-slate-400"></i> DUE DATE</th>
                <th className={`${TH} whitespace-nowrap text-center`}><i className="ph ph-flag mr-2 text-slate-400"></i> STATUS</th>
                <th className={`${TH} text-right`}><i className="ph ph-lightning mr-2 text-slate-400"></i> ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {jobs.map((a) => (
                <JobStatusRow
                  key={a.id}
                  job={a}
                  layoutSchema={layoutSchema}
                  isSelected={selectedJobId === a.id}
                  onOpenDetails={onOpenDetails}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  renderAssignees={renderAssignees}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center p-16 text-slate-400 h-full">
          <i className="ph-fill ph-images text-5xl mb-4 text-slate-300"></i>
          <p className="font-bold text-lg text-slate-500">No pending jobs.</p>
        </div>
      )}

      {/* Pagination Controls */}
      {totalCount > 0 && (
        <JobStatusPagination page={page} totalPages={totalPages} perPage={perPage} totalCount={totalCount} onPageChange={onPageChange} />
      )}
    </div>
  );
}
