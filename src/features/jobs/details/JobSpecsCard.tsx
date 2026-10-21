import { FileText } from "lucide-react";
import type { SpecEntry } from "@/lib/jobs/resolveJobFields";
import { DetailsCard, InfoRow } from "./DetailsCard";

/** "Job Details": category, size, quantity, rate and total per line item. */
export default function JobSpecsCard({ entries }: { entries: SpecEntry[] }) {
  return (
    <DetailsCard icon={<FileText className="w-4 h-4 text-blue-500" />} iconBg="bg-blue-50" title="Job Details">
      <div className="flex flex-col gap-0 divide-y divide-slate-50">
        {entries.map((entry, index) => (
          <div key={index} className={`flex flex-col gap-0 divide-y divide-slate-50 ${index > 0 ? "mt-3 pt-3 border-t border-slate-100" : ""}`}>
            {entries.length > 1 && <div className="text-xs font-bold text-slate-400 mb-1 uppercase tracking-wider py-2">Item {index + 1}</div>}

            {entry.category && <InfoRow label="Category">{entry.category}</InfoRow>}
            <InfoRow label="Size">{entry.size || "N/A"}</InfoRow>
            <InfoRow label="Quantity">{entry.quantity || "N/A"}</InfoRow>
            <InfoRow label="Rate">{entry.rateLabel}</InfoRow>
            {entry.total !== null && (
              <div className="flex justify-between items-center py-3 bg-slate-50/50 -mx-4 px-4 rounded-b-lg mt-1 border-t border-slate-100">
                <span className="text-sm text-slate-600 font-bold">Total</span>
                <span className="text-sm font-bold text-slate-900 text-right">₹ {entry.total.toLocaleString("en-IN")}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </DetailsCard>
  );
}
