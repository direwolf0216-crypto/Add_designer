"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import CustomDropdown from "@/components/ui/CustomDropdown";
import DatePickerInput from "@/components/ui/DatePickerInput";
import { toLocalISODate } from "@/lib/dates";
import { newInstallment } from "@/lib/jobs/formMapping";
import { installmentsTotal, type Installment } from "@/lib/jobs/pricing";
import { useJobFormContext } from "./JobFormContext";

const PAYMENT_MODE_OPTIONS = ["Cash", "UPI"].map((m) => ({ label: m, value: m }));
const amountOnly = (value: string) => value.replace(/[^0-9.]/g, "");

/**
 * Replaces the layout's "advance" field: a single advance + payment mode, or a list of dated
 * installments. Edits stay local until the job is saved (saveJobAction syncs the payments).
 */
export default function InstallmentsEditor() {
  const { installments, setInstallments, isMultiInstallment, setIsMultiInstallment } = useJobFormContext();

  const updateFirst = (patch: Partial<Installment>) => {
    const newInst = [...installments];
    if (newInst.length === 0) newInst.push(newInstallment());
    newInst[0] = { ...newInst[0], ...patch };
    setInstallments(newInst);
  };
  const updateAt = (idx: number, patch: Partial<Installment>) => {
    const newInst = [...installments];
    newInst[idx] = { ...newInst[idx], ...patch };
    setInstallments(newInst);
  };
  // Removing an installment only edits the form; the payment is deleted when the job is saved,
  // so cancelling the form leaves it untouched.
  const removeAt = (idx: number) => {
    if (installments.length === 2) setIsMultiInstallment(false);
    setInstallments(installments.filter((_, i) => i !== idx));
  };

  return (
    <AnimatePresence mode="popLayout">
      {!isMultiInstallment ? (
        <React.Fragment key="single-installment">
          <motion.div layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} className="md:col-span-6 flex flex-col gap-1.5 relative">
            <div className="flex justify-between items-center h-[20px]">
              <label className="text-[0.75rem] font-bold text-slate-600 uppercase tracking-[0.5px]">Advance Paid (₹)</label>
              <button
                type="button"
                onClick={() => {
                  setIsMultiInstallment(true);
                  setInstallments([...installments, newInstallment()]);
                }}
                className="text-[0.75rem] font-bold text-orange-500 hover:text-orange-600 flex items-center gap-1 transition-colors whitespace-nowrap"
              >
                <i className="ph-bold ph-plus"></i> Add Installment
              </button>
            </div>
            <div className="relative mt-1">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</div>
              <input type="text" value={installments[0]?.amount || ""} onChange={(e) => updateFirst({ amount: amountOnly(e.target.value) })} className="flex h-[45px] w-full rounded-xl border border-gray-200 bg-white pl-8 pr-4 py-2 text-[0.95rem] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500" placeholder="Amount" />
            </div>
          </motion.div>
          <motion.div layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} className="md:col-span-6 w-full flex flex-col gap-1.5 relative">
            <div className="h-[20px] flex items-center">
              <label className="text-[0.75rem] font-bold text-slate-600 uppercase tracking-[0.5px]">Payment Mode</label>
            </div>
            <div className="relative custom-dropdown-container mt-1">
              <CustomDropdown
                options={PAYMENT_MODE_OPTIONS}
                value={installments[0]?.paymentMode || "Cash"}
                onChange={(val) => updateFirst({ paymentMode: val })}
                placeholder="Select Payment Mode"
              />
            </div>
          </motion.div>
        </React.Fragment>
      ) : (
        <motion.div key="multi-installment" layout initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.3 }} className="md:col-span-12 flex flex-col gap-1.5">
          <div className="flex justify-between items-center h-[20px]">
            <label className="text-[0.75rem] font-bold text-slate-600 uppercase tracking-[0.5px]">Payments & Installments</label>
            <button
              type="button"
              onClick={() => setInstallments([...installments, { amount: "", date: toLocalISODate(), paymentMode: "Cash" }])}
              className="text-[0.7rem] font-bold text-orange-500 hover:text-orange-600 flex items-center gap-1 transition-colors bg-orange-50 px-3 py-1.5 rounded-lg -mr-1"
            >
              <i className="ph-bold ph-plus"></i> Add Installment
            </button>
          </div>

          <div className="flex flex-col gap-3 mt-1">
            {installments.map((inst, idx) => (
              <motion.div layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} key={idx} className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                <div className="flex-[1.5] relative w-full">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-[0.95rem] z-10 pointer-events-none">₹</div>
                  <input type="text" value={inst.amount || ""} onChange={(e) => updateAt(idx, { amount: amountOnly(e.target.value) })} className="flex h-[42px] w-full rounded-xl border border-gray-200 bg-white pl-8 pr-3 py-2 text-[0.95rem] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500" placeholder="Amount" />
                </div>
                <div className="w-full sm:w-[130px] shrink-0 h-[42px] relative">
                  <DatePickerInput
                    value={inst.date ? (/^\d{4}-\d{2}-\d{2}$/.test(inst.date) ? inst.date : toLocalISODate(new Date(inst.date))) : ""}
                    onChange={(val) => updateAt(idx, { date: val })}
                  />
                </div>
                <div className="w-full sm:w-[130px] shrink-0 h-[42px] relative custom-dropdown-container">
                  <CustomDropdown
                    options={PAYMENT_MODE_OPTIONS}
                    value={inst.paymentMode || "Cash"}
                    onChange={(val) => updateAt(idx, { paymentMode: val })}
                    placeholder="Mode"
                  />
                </div>
                <button type="button" onClick={() => removeAt(idx)} className="w-[42px] h-[42px] shrink-0 rounded-xl bg-white border border-red-100 text-red-500 hover:bg-red-50 hover:border-red-200 flex items-center justify-center transition-colors">
                  <i className="ph-bold ph-trash"></i>
                </button>
              </motion.div>
            ))}
          </div>
          <div className="text-[0.8rem] text-slate-500 font-bold bg-slate-100 rounded-lg px-3 py-2 mt-1 w-fit border border-slate-200">
            Total Advance: <span className="text-slate-800">₹{installmentsTotal(installments).toLocaleString("en-IN")}</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
