import { UserCircle } from "lucide-react";
import type { DetailsJob } from "@/lib/jobs/resolveJobFields";
import { DetailsCard, InfoRow } from "./DetailsCard";

export default function ClientCard({ job }: { job: DetailsJob }) {
  return (
    <DetailsCard icon={<UserCircle className="w-4 h-4 text-indigo-500" />} iconBg="bg-indigo-50" title="Client Information">
      <div className="flex flex-col gap-0 divide-y divide-slate-50">
        <InfoRow label="Client Name / Company">{job.client?.name || job.title || job.customData?.fld_b_client || "N/A"}</InfoRow>
        <InfoRow label="Phone Number">{job.client?.phone || job.phone || job.customData?.fld_b_phone || "N/A"}</InfoRow>
        <InfoRow label="Email Address">{job.client?.email || job.email || job.customData?.fld_b_email || "N/A"}</InfoRow>
      </div>
    </DetailsCard>
  );
}
