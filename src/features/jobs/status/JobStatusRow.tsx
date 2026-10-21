"use client";

import type React from "react";
import { parseJobCustomData, type StatusBoardJob } from "@/lib/jobs/statusCounts";
import {
  formatJobOrderDate,
  getRowStatusStyle,
  jobDisplayNumber,
  overdueDays,
  resolveJobRowFields,
  type JobLayoutSchema,
} from "@/lib/jobs/statusRow";

export interface JobStatusRowProps {
  job: StatusBoardJob;
  layoutSchema: JobLayoutSchema | null | undefined;
  isSelected: boolean;
  onOpenDetails: (jobId: string) => void;
  onEdit: (jobId: string) => void;
  onDelete: (jobId: string) => void;
  /**
   * Slot for an assignees avatar stack, rendered under the customer name. Nothing is rendered
   * today; pass e.g. `(job) => <AvatarStack users={...} />` once assignments land.
   */
  renderAssignees?: (job: StatusBoardJob) => React.ReactNode;
}

export default function JobStatusRow({ job: a, layoutSchema, isSelected, onOpenDetails, onEdit, onDelete, renderAssignees }: JobStatusRowProps) {
  const cData = parseJobCustomData(a.customData);
  const formattedOrderDate = formatJobOrderDate(a.date);
  const { deliveryDateStr, formattedDeliveryDate, category: finalCategory, size: resolvedSize, qty: resolvedQty } =
    resolveJobRowFields(a, cData, layoutSchema);

  const statusLabel: string = cData.fld_b_status || 'Pending';
  const { bg: statusBg, text: statusText, dot: statusDot } = getRowStatusStyle(statusLabel);
  const daysOverdue = overdueDays(deliveryDateStr, statusLabel);
  const assignees = renderAssignees?.(a) ?? null;

  return (
    <tr className={`group hover:bg-slate-50/80 transition-colors ${isSelected ? 'bg-slate-50' : ''}`}>
      <td
        className="p-5 whitespace-nowrap cursor-pointer"
        onClick={() => onOpenDetails(a.id)}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-200 overflow-hidden flex items-center justify-center text-slate-500 font-black uppercase text-lg group-hover:bg-purple-100 group-hover:text-purple-600 transition-colors">
            {a.client?.name?.charAt(0)}
          </div>
          <div>
            <div className="font-black text-slate-800 text-sm group-hover:text-purple-600 transition-colors">{a.client?.name}</div>
            <div className="text-xs text-slate-500 font-medium">{formattedOrderDate}</div>
            {assignees}
          </div>
        </div>
      </td>
      <td
        className="p-5 whitespace-nowrap cursor-pointer"
        onClick={() => onOpenDetails(a.id)}
      >
        <span className="text-purple-600 font-black text-sm hover:underline">
          {jobDisplayNumber(a)}
        </span>
      </td>
      <td className="p-5 whitespace-nowrap">
        <div className="text-sm font-bold text-slate-700">{finalCategory}</div>
      </td>
      <td className="p-5 whitespace-nowrap">
        <div className="text-sm font-bold text-slate-700">
          {resolvedSize ? `${resolvedSize} ` : ''}
          {resolvedQty ? `(${resolvedQty} pcs)` : (resolvedSize ? '' : '-')}
          {!resolvedSize && !resolvedQty && '-'}
        </div>
      </td>
      <td className="p-5 whitespace-nowrap text-center align-middle">
        <div className="text-sm font-bold text-slate-700">{formattedDeliveryDate}</div>
        {daysOverdue !== null && (
          <div className="text-[0.65rem] text-orange-500 font-bold mt-1 text-center">Overdue by {daysOverdue} days</div>
        )}
      </td>
      <td className="p-5 whitespace-nowrap text-center align-middle">
        <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold ${statusBg} ${statusText}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${statusDot}`}></span>
          {statusLabel}
        </span>
      </td>
      <td className="p-5 text-right whitespace-nowrap">
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(a.id); }}
            className="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-50 text-blue-500 hover:bg-blue-100 hover:text-blue-600 border border-blue-100 transition-colors shadow-sm"
            title="Edit Job"
          >
            <i className="ph ph-pencil-simple text-base"></i>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(a.id);
            }}
            className="w-8 h-8 rounded-lg flex items-center justify-center bg-pink-50 text-pink-500 hover:bg-pink-100 hover:text-pink-600 border border-pink-100 transition-colors shadow-sm"
            title="Delete Job"
          >
            <i className="ph ph-trash text-base"></i>
          </button>
        </div>
      </td>
    </tr>
  );
}
