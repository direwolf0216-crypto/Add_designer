import { UserCircle } from "lucide-react";
import type { DetailsJob } from "@/lib/jobs/resolveJobFields";
import { DetailsCard, InfoRow } from "./DetailsCard";

export default function ClientCard({ job, onWhatsApp }: { job: DetailsJob; onWhatsApp?: () => void }) {
  const phone = job.client?.phone || job.phone || job.customData?.fld_b_phone;
  return (
    <DetailsCard icon={<UserCircle className="w-4 h-4 text-indigo-500" />} iconBg="bg-indigo-50" title="Client Information">
      <div className="flex flex-col gap-0 divide-y divide-slate-50">
        <InfoRow label="Client Name / Company">{job.client?.name || job.title || job.customData?.fld_b_client || "N/A"}</InfoRow>
        <InfoRow label="Phone Number">
          <span className="inline-flex items-center gap-2">
            {phone || "N/A"}
            {phone && onWhatsApp && (
              <button
                type="button"
                onClick={onWhatsApp}
                className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-0.5 text-[0.72rem] font-bold text-emerald-700 ring-1 ring-emerald-200 transition-colors hover:bg-emerald-100 print:hidden"
                title="Chat on WhatsApp"
              >
                <i className="ph-fill ph-whatsapp-logo" aria-hidden="true"></i>
                WhatsApp
              </button>
            )}
          </span>
        </InfoRow>
        <InfoRow label="Email Address">{job.client?.email || job.email || job.customData?.fld_b_email || "N/A"}</InfoRow>
      </div>
    </DetailsCard>
  );
}
