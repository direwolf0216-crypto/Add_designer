"use client";

import { Edit3, FileDown, Receipt, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import type { DetailsJob } from "@/lib/jobs/resolveJobFields";

/** Status badge and the edit / delete / PDF export / invoice icon actions. */
export default function JobHeaderActions({
  job,
  canEditJobs,
  canDeleteJobs,
  canManageTransactions,
  isExporting,
  isGeneratingInvoice,
  onEdit,
  onDelete,
  onExport,
  onInvoice,
  assigneesSlot,
}: {
  job: DetailsJob;
  canEditJobs: boolean;
  canDeleteJobs: boolean;
  canManageTransactions: boolean;
  isExporting: boolean;
  isGeneratingInvoice: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onExport: () => void;
  onInvoice: () => void;
  /** Rendered first in the row (assignees avatar stack). */
  assigneesSlot?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 flex-wrap print:hidden">
      {assigneesSlot}

      {/* Status Badge */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 text-orange-600 border border-orange-100 rounded-lg text-sm font-bold">
        <span className="w-2 h-2 rounded-full bg-orange-500"></span> {job.status || "Pending"}
      </div>

      {/* Edit, delete, export, invoice: icons only, with a tooltip each */}
      <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-1 shadow-sm">
        {canEditJobs && (
          <button onClick={onEdit} className="p-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900 rounded-md transition-colors" title="Edit job" aria-label="Edit job">
            <Edit3 className="w-4 h-4" />
          </button>
        )}
        {canDeleteJobs && (
          <button onClick={onDelete} className="p-1.5 text-red-500 hover:bg-red-50 rounded-md transition-colors" title="Delete job" aria-label="Delete job">
            <Trash2 className="w-4 h-4" />
          </button>
        )}
        <button onClick={onExport} disabled={isExporting} className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-md transition-colors disabled:opacity-50" title="Download PDF summary" aria-label="Download PDF summary">
          <FileDown className="w-4 h-4" />
        </button>
        {canManageTransactions && (
          <button onClick={onInvoice} disabled={isGeneratingInvoice} className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-md transition-colors" title="Generate invoice" aria-label="Generate invoice">
            <Receipt className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
