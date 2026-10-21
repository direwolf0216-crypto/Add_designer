"use client";

import type { ReactNode } from "react";
import CustomDropdown from "@/components/ui/CustomDropdown";
import DatePickerInput from "@/components/ui/DatePickerInput";
import {
  getJobDeliveryDate,
  parseJobCustomData,
  type JobTrackingUpdate,
  type StatusBoardJob,
  type StatusBoardUser,
} from "@/lib/jobs/statusCounts";
import { formatJobOrderDate, getDetailStatusStyle, jobDisplayNumber } from "@/lib/jobs/statusRow";

interface JobStatusDetailPanelProps {
  job: StatusBoardJob;
  teamUsers: StatusBoardUser[];
  onClose: () => void;
  onUpdate: (jobId: string, updates: JobTrackingUpdate) => void;
  onViewDetails: () => void;
}

function DetailRow({ label, children, alignStart = false }: { label: string; children: ReactNode; alignStart?: boolean }) {
  return (
    <div className={`grid grid-cols-[110px_1fr] text-[0.85rem] ${alignStart ? 'items-start' : 'items-center'}`}>
      <div className="text-slate-500 font-medium">{label}</div>
      <div className="font-black text-slate-800 flex items-center gap-2">{children}</div>
    </div>
  );
}

const Colon = () => <span className="text-slate-400 font-normal">:</span>;

/** Right-hand side panel for the selected job: key facts, designer/delivery editors, timeline, quick actions. */
export default function JobStatusDetailPanel({ job: selectedJob, teamUsers, onClose, onUpdate, onViewDetails }: JobStatusDetailPanelProps) {
  const cData = parseJobCustomData(selectedJob.customData);

  const statusLabel: string = cData.fld_b_status || 'Pending';
  const { color: statusColor, progress } = getDetailStatusStyle(statusLabel, cData.job_progress);
  const isDelivered = statusLabel.toLowerCase() === 'delivered';

  const formattedOrderDate = formatJobOrderDate(selectedJob.date);

  const designerId = cData.designer;
  const deliveryDateStr = getJobDeliveryDate(cData);

  return (
    <div className="w-full lg:w-[380px] bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col relative sticky top-[80px] h-[calc(100vh-100px)] overflow-y-auto hide-scrollbar">
      <button
        onClick={onClose}
        className="absolute top-6 right-6 text-slate-400 hover:text-slate-600"
      >
        <i className="ph-bold ph-x text-lg"></i>
      </button>

      <h3 className="text-lg font-black text-slate-800 pr-8">{selectedJob.client?.name} – {selectedJob.category}</h3>

      <div className="mt-3">
        <span className={`px-2.5 py-1 rounded-md text-[0.7rem] font-bold ${statusColor}`}>
          {statusLabel}
        </span>
      </div>

      <div className="mt-8 space-y-4">
        <DetailRow label="Job ID"><Colon /> {jobDisplayNumber(selectedJob)}</DetailRow>
        <DetailRow label="Order Date"><Colon /> {formattedOrderDate}</DetailRow>
        <DetailRow label="Designer">
          <Colon />
          <CustomDropdown
            options={[{ label: "Unassigned", value: "" }, ...teamUsers.map(u => ({ label: u.name, value: u.id }))]}
            value={designerId || ""}
            onChange={(val) => onUpdate(selectedJob.id, { customData: { designer: val } })}
            className="w-40 border-b border-dashed border-slate-300 rounded-none shadow-none bg-transparent"
            placeholder="Unassigned"
          />
        </DetailRow>
        <DetailRow label="Delivery Date">
          <Colon />
          <DatePickerInput
            value={deliveryDateStr ? new Date(deliveryDateStr).toISOString().split('T')[0] : ""}
            onChange={(val) => onUpdate(selectedJob.id, { customData: { job_delivery_date: val } })}
            className="flex items-center justify-between bg-white text-[0.8rem] border border-slate-200 rounded-lg px-3 py-1.5 outline-none hover:border-slate-300 hover:shadow-sm transition-all cursor-pointer w-[140px] h-[34px]"
          />
          {deliveryDateStr && new Date(deliveryDateStr) < new Date() && !isDelivered && (
            <span className="text-orange-500 font-bold ml-1">(Overdue)</span>
          )}
        </DetailRow>
        <DetailRow label="Job Size"><Colon /> {cData.job_size || 'Not specified'}</DetailRow>
        <DetailRow label="Pages"><Colon /> {cData.job_pages || 'Not specified'}</DetailRow>
        <DetailRow label="Job Type"><Colon /> {cData.fld_b_job_type || cData.job_type || 'Premium'}</DetailRow>
        <DetailRow label="Remarks" alignStart><Colon /> {cData.job_remarks || 'Designing in progress'}</DetailRow>
      </div>

      <div className="mt-8 pt-6 relative">
        <h4 className="font-black text-slate-800 text-sm mb-6">Timeline</h4>

        <div className="relative pl-6 space-y-7">
          <div className="absolute left-[7px] top-[8px] bottom-[15px] w-[2px] bg-slate-100"></div>

          <div className="relative">
            <div className="absolute -left-[1.65rem] w-4 h-4 rounded-full bg-emerald-500 border-[3px] border-white flex items-center justify-center shadow-sm">
              <i className="ph-bold ph-check text-white text-[0.45rem]"></i>
            </div>
            <div className="flex justify-between items-start -mt-0.5">
              <div className="font-black text-slate-800 text-[0.8rem]">Pending</div>
              <div className="text-[0.7rem] text-slate-400 font-medium">{formattedOrderDate}</div>
            </div>
          </div>

          <div className="relative">
            <div className={`absolute -left-[1.65rem] w-4 h-4 rounded-full border-[3px] border-white flex items-center justify-center shadow-sm ${progress >= 25 ? 'bg-white border-orange-400' : 'bg-slate-200'}`}>
              {progress >= 25 && <div className="w-1.5 h-1.5 bg-orange-400 rounded-full"></div>}
            </div>
            <div className="flex justify-between items-start -mt-0.5">
              <div className={`font-black text-[0.8rem] ${progress >= 25 ? 'text-slate-800' : 'text-slate-400'}`}>Designing</div>
              <div className="text-[0.7rem] text-slate-400 font-medium">{progress >= 25 ? 'Started' : 'Pending'}</div>
            </div>
          </div>

          <div className="relative">
            <div className={`absolute -left-[1.65rem] w-4 h-4 rounded-full border-[3px] border-white flex items-center justify-center shadow-sm ${progress >= 50 ? 'bg-white border-purple-400' : 'bg-slate-200'}`}>
              {progress >= 50 && <div className="w-1.5 h-1.5 bg-purple-400 rounded-full"></div>}
            </div>
            <div className="flex justify-between items-start -mt-0.5">
              <div className={`font-black text-[0.8rem] ${progress >= 50 ? 'text-slate-800' : 'text-slate-400'}`}>Printing</div>
              <div className="text-[0.7rem] text-slate-400 font-medium">{progress >= 50 ? 'Sent' : 'Pending'}</div>
            </div>
          </div>

          <div className="relative">
            <div className={`absolute -left-[1.65rem] w-4 h-4 rounded-full border-[3px] border-white flex items-center justify-center shadow-sm ${progress >= 75 ? 'bg-emerald-500' : 'bg-white border-slate-200'}`}>
              {progress >= 75 && <i className="ph-bold ph-check text-white text-[0.45rem]"></i>}
            </div>
            <div className="flex justify-between items-start -mt-0.5">
              <div className={`font-black text-[0.8rem] ${progress >= 75 ? 'text-slate-800' : 'text-slate-400'}`}>Ready for Delivery</div>
              <div className="text-[0.7rem] text-slate-400 font-medium">{progress >= 75 ? 'Ready' : 'Pending'}</div>
            </div>
          </div>

          <div className="relative">
            <div className={`absolute -left-[1.65rem] w-4 h-4 rounded-full border-[3px] border-white flex items-center justify-center shadow-sm ${isDelivered ? 'bg-blue-500' : 'bg-white border-slate-200'}`}>
              {isDelivered && <i className="ph-bold ph-check text-white text-[0.45rem]"></i>}
            </div>
            <div className="flex justify-between items-start -mt-0.5">
              <div className={`font-black text-[0.8rem] ${isDelivered ? 'text-slate-800' : 'text-slate-400'}`}>Delivered</div>
              <div className="text-[0.7rem] text-slate-400 font-medium">{isDelivered ? 'Delivered' : 'Pending'}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 border-t border-slate-100 pt-6">
        <h4 className="font-black text-slate-800 text-sm mb-4">Quick Actions</h4>
        <div className="flex items-center gap-3">
          <button className="flex-1 py-2.5 rounded-xl border border-purple-200 text-purple-700 font-bold text-xs hover:bg-purple-50 flex items-center justify-center gap-2 transition-colors">
            <i className="ph-bold ph-upload-simple"></i> Upload Draft
          </button>
          <button
            onClick={onViewDetails}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 flex items-center justify-center gap-2 transition-colors"
          >
            <i className="ph-bold ph-eye"></i> View Details
          </button>
        </div>
        <button
          onClick={() => onUpdate(selectedJob.id, { status: 'Delivered', customData: { fld_b_status: 'Delivered', job_progress: '100' } })}
          className="w-full mt-3 py-3 rounded-xl bg-purple-700 text-white font-bold text-sm hover:bg-purple-800 flex items-center justify-center gap-2 shadow-md transition-colors"
        >
          <i className="ph-bold ph-check-circle"></i> Mark as Completed
        </button>
      </div>
    </div>
  );
}
