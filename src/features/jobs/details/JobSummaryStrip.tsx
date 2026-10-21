import { format } from "date-fns";
import { Calendar, FileText } from "lucide-react";
import type { DetailsJob, JobSummary } from "@/lib/jobs/resolveJobFields";

/** Job id, category, created date and due date across the top of the details view. */
export default function JobSummaryStrip({ job, summary }: { job: DetailsJob; summary: JobSummary }) {
  const { displayCategory, dueDateVal } = summary;
  return (
    <div className="w-full bg-white rounded-xl p-6 border border-slate-100 flex flex-col md:flex-row items-center divide-y md:divide-y-0 md:divide-x divide-slate-100 shadow-sm">
      <div className="flex-1 flex flex-col gap-1 w-full md:w-auto p-4 md:p-0 md:px-4">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">JOB ID</p>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-fuchsia-50 border border-fuchsia-100 flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5 text-fuchsia-600" />
          </div>
          <p className="text-lg font-bold text-fuchsia-600">{job.jobNumber || `#${job.id.slice(-6).toUpperCase()}`}</p>
        </div>
      </div>

      <div className="flex-1 flex flex-col gap-2 w-full md:w-auto p-4 md:p-0 md:px-4">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">CATEGORY</p>
        <div className="flex items-center gap-2">
          <p className="text-sm font-bold text-slate-800">{displayCategory && displayCategory !== "N/A" && displayCategory !== "-" ? displayCategory : "Not specified"}</p>
        </div>
      </div>
      <div className="flex-1 flex flex-col gap-2 w-full md:w-auto p-4 md:p-0 md:px-4">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">CREATED ON</p>
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-400" />
          <p className="text-sm font-bold text-slate-800">{format(new Date(job.createdAt), "dd MMM yyyy, hh:mm a")}</p>
        </div>
      </div>
      <div className="flex-1 flex flex-col gap-2 w-full md:w-auto p-4 md:p-0 md:px-4">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">DUE DATE</p>
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-400" />
          <p className="text-sm font-bold text-slate-800">{dueDateVal ? format(new Date(dueDateVal), "dd MMM yyyy") : "Not set"}</p>
        </div>
      </div>
    </div>
  );
}
