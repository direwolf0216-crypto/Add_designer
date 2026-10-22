import { IndianRupee } from "lucide-react";
import type { JobFinancials } from "@/lib/jobs/resolveJobFields";
import { refundDue, type Cancellation } from "@/lib/jobs/cancellation";
import { DetailsCard, InfoRow } from "./DetailsCard";

const money = (n: number) => `₹ ${n.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

export default function FinancialsCard({ financials, cancellation = null }: { financials: JobFinancials; /** Set when the job is cancelled: shows the charge and refund instead of a balance. */ cancellation?: Cancellation | null }) {
  const { totalAmount, advanceAmount, dueAmount, paymentMethod } = financials;
  const refund = cancellation ? refundDue(advanceAmount, cancellation.charge) : 0;
  return (
    <DetailsCard icon={<IndianRupee className="w-4 h-4 text-green-600" />} iconBg="bg-green-50" title="Financials">
      <div className="flex flex-col gap-0 divide-y divide-slate-50">
        <InfoRow label="Total Amount (₹)">{money(totalAmount)}</InfoRow>
        <div className="flex justify-between items-center py-3">
          <span className="text-sm text-slate-500 font-medium flex items-center gap-2">
            Advance Paid (₹)
            {paymentMethod && paymentMethod !== "N/A" && (
              <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider">{paymentMethod}</span>
            )}
          </span>
          <span className="text-sm font-bold text-slate-800 text-right">{money(advanceAmount)}</span>
        </div>
        {cancellation ? (
          <>
            <InfoRow label="Cancellation charge">{money(cancellation.charge)}</InfoRow>
            <div className="flex justify-between items-center pt-3 pb-1 mt-2">
              <span className="text-sm text-slate-800 font-bold">Refund due to client</span>
              <span className={`text-sm font-bold px-3 py-1 rounded-md text-right border ${refund > 0 ? "text-rose-700 bg-rose-50 border-rose-100" : "text-slate-600 bg-slate-50 border-slate-100"}`}>{money(refund)}</span>
            </div>
          </>
        ) : (
          <div className="flex justify-between items-center pt-3 pb-1 mt-2">
            <span className="text-sm text-slate-800 font-bold">Outstanding Balance</span>
            <span className="text-sm font-bold text-green-700 bg-green-50 border border-green-100 px-3 py-1 rounded-md text-right">{money(dueAmount)}</span>
          </div>
        )}
      </div>
    </DetailsCard>
  );
}
