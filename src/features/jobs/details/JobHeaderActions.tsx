"use client";

import { Edit3, Printer, Receipt, Trash2, Upload } from "lucide-react";
import type { ReactNode } from "react";
import type { DetailsJob } from "@/lib/jobs/resolveJobFields";

/** Status badge and the edit / print / delete / export / invoice actions. */
export default function JobHeaderActions({
  job,
  canManageJobs,
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
  canManageJobs: boolean;
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

      {/* Edit Job */}
      {canManageJobs && (
        <button onClick={onEdit} className="flex items-center gap-2 px-3 py-1.5 border border-slate-200 rounded-lg text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors bg-white shadow-sm">
          <Edit3 className="w-4 h-4" /> Edit Job
        </button>
      )}

      {/* Print Summary */}
      <button type="button" onClick={() => window.print()} className="flex items-center gap-2 px-3 py-1.5 border border-slate-200 rounded-lg text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors bg-white shadow-sm">
        <Printer className="w-4 h-4" /> Print Summary
      </button>

      {/* Vertical Divider */}
      <div className="hidden md:block w-px h-6 bg-slate-200 mx-1"></div>

      {/* Legacy Actions (Delete, Export, Invoice) */}
      <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-1 shadow-sm">
        {canManageJobs && (
          <button onClick={onDelete} className="p-1.5 text-red-500 hover:bg-red-50 rounded-md transition-colors" title="Delete" aria-label="Delete job">
            <Trash2 className="w-4 h-4" />
          </button>
        )}
        <button onClick={onExport} disabled={isExporting} className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-md transition-colors" title="Export" aria-label="Export job">
          <Upload className="w-4 h-4" />
        </button>
        {canManageTransactions && (
          <button onClick={onInvoice} disabled={isGeneratingInvoice} className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-md transition-colors" title="Invoice" aria-label="Generate invoice">
            <Receipt className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
