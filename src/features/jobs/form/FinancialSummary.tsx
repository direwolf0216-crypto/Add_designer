"use client";

import { outstandingBalance, packageAmount } from "@/lib/jobs/pricing";
import { useJobFormContext } from "./JobFormContext";

/** Read-only grand total (package after discount), shown after the discount field. */
export function GrandTotal() {
  const { form } = useJobFormContext();
  return (
    <div className="flex flex-col gap-1.5 w-full md:col-span-6">
      <div className="flex justify-between items-center">
        <label className="text-[0.75rem] font-bold text-slate-600 uppercase tracking-[0.5px]">Grand Total</label>
      </div>
      <div className="flex h-[34px] sm:h-[42px] w-full rounded-[14px] bg-slate-50 border border-slate-200 px-4 items-center justify-end shadow-inner">
        <span className="text-[1.15rem] font-black text-slate-800">₹ {packageAmount(form.watch("package")).toLocaleString("en-IN")}</span>
      </div>
    </div>
  );
}

/** Grand total − installments, at the end of the financial section. */
export function OutstandingBalance() {
  const { form, installments } = useJobFormContext();
  return (
    <div className="bg-orange-50 border border-orange-100 rounded-2xl p-5 flex items-center justify-between w-full md:col-span-12 mt-2 shadow-sm">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-[14px] bg-orange-100/50 flex items-center justify-center text-orange-600 border border-orange-200/50">
          <i className="ph-fill ph-calculator text-[1.4rem]"></i>
        </div>
        <span className="font-bold text-slate-800 text-[1.05rem]">Outstanding Balance</span>
      </div>
      <span className="text-[1.6rem] font-black text-orange-600 tracking-tight">
        ₹ {outstandingBalance(form.watch("package"), installments).toLocaleString("en-IN")}
      </span>
    </div>
  );
}
