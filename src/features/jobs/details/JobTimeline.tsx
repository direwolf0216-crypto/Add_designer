import { Clock } from "lucide-react";
import JobStatusStepper from "@/components/dashboard/JobStatusStepper";
import type { FormLayout } from "@/lib/forms/types";
import { buildStatusSteps, type DetailsJob } from "@/lib/jobs/resolveJobFields";

/** "Job Status & Timeline": clickable status stepper built from the layout's status options. */
export default function JobTimeline({ job, layout, onStatusChange }: { job: DetailsJob; layout: FormLayout | null; onStatusChange: (status: string) => void }) {
  const steps = buildStatusSteps(layout);
  return (
    <div className="bg-white rounded-xl p-6 border border-slate-100 shadow-sm mt-4">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-8 h-8 rounded-lg bg-pink-50 flex items-center justify-center">
          <Clock className="w-4 h-4 text-pink-500" />
        </div>
        <h3 className="font-bold text-slate-800 text-[15px]">Job Status & Timeline</h3>
      </div>
      <div className="px-4 pb-2">
        <JobStatusStepper
          steps={steps}
          currentStatus={job.status || (steps.length > 0 ? steps[0].value : "Pending")}
          onStatusChange={(val) => onStatusChange(val)}
          className="w-full"
        />
      </div>
    </div>
  );
}
