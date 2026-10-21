import { Clock } from "lucide-react";
import JobStatusStepper from "@/components/dashboard/JobStatusStepper";
import type { FormLayout } from "@/lib/forms/types";
import { buildStatusSteps, type DetailsJob } from "@/lib/jobs/resolveJobFields";

/** The job's stage as a slim bar at the top of the details: click any stage to move the job there. */
export default function JobTimeline({ job, layout, onStatusChange }: { job: DetailsJob; layout: FormLayout | null; onStatusChange: (status: string) => void }) {
  const steps = buildStatusSteps(layout);
  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-slate-100 bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:gap-3">
      <div className="flex shrink-0 items-center gap-2" title="Status">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-pink-50">
          <Clock className="h-3.5 w-3.5 text-pink-500" />
        </div>
        <h3 className="text-[13px] font-bold text-slate-800 sm:sr-only">Status</h3>
      </div>
      <JobStatusStepper
        steps={steps}
        currentStatus={job.status || (steps.length > 0 ? steps[0].value : "Pending")}
        onStatusChange={(val) => onStatusChange(val)}
        className="min-w-0 flex-1"
      />
    </div>
  );
}
