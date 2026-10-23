"use client";

import type { ReactNode } from "react";
import { JOB_FORM_FIELD_MAP } from "@/lib/forms/fieldMap";
import { useEffect, useRef } from "react";
import { defaultRateUpdates, isAreaPricing, parseQuantity, lineItemRows, lineItemTotal, lineMultiplier, pricingRuleFor, pricingUnitLabel, sumLineItems, type AutoRates } from "@/lib/jobs/pricing";
import { useJobFormContext } from "./JobFormContext";

const amountOnly = (value: string) => value.replace(/[^0-9.]/g, "");

/** "Rates per Job": a rate input per repeatable line item, its line total and the sum of all lines. */
export default function LineItemRates() {
  const { repeatableData, financialRates, setFinancialRates, layoutSchema, pricingRules } = useJobFormContext();
  const rows = lineItemRows(repeatableData, layoutSchema, JOB_FORM_FIELD_MAP);
  const sum = sumLineItems(repeatableData, financialRates, layoutSchema, JOB_FORM_FIELD_MAP, pricingRules);

  // A category's default rate (Settings → Pricing) fills an untouched rate box, and follows the line when
  // its category changes while the box still holds that default. Typing always wins.
  const autoFilled = useRef<AutoRates>({});
  useEffect(() => {
    const { patch, auto } = defaultRateUpdates(rows, financialRates, pricingRules, autoFilled.current);
    autoFilled.current = auto;
    const keys = Object.keys(patch);
    if (!keys.length) return;
    setFinancialRates((prev) => {
      const next = { ...prev };
      for (const k of keys) {
        // Only where the box still holds what was looked at (nothing typed in between).
        if (prev[k] !== financialRates[k]) continue;
        if (patch[k] === null) delete next[k];
        else next[k] = patch[k]!;
      }
      return next;
    });
  }, [rows, pricingRules, financialRates, setFinancialRates]);

  return (
    <div className="flex flex-col gap-3 w-full md:col-span-12 mb-4">
      <label className="text-[0.75rem] font-bold text-slate-500 uppercase tracking-[1px]">Rates per Job</label>
      <div className="flex flex-col gap-2">
        {rows.map((row) => {
          const { unit } = pricingRuleFor(pricingRules, row.category);
          const { area } = lineMultiplier(unit, row.qty, row.size);
          const byArea = isAreaPricing(unit);
          const unitText = pricingUnitLabel(unit);
          return (
          <div key={row.rateKey} data-testid="rate-row" data-rate-key={row.rateKey} className="flex flex-wrap items-center justify-between gap-3 bg-slate-50/80 hover:bg-slate-50 transition-colors border border-slate-100/50 rounded-2xl p-2.5 sm:p-3">
            <div className="flex min-w-0 items-center gap-3 sm:gap-4">
              <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-[14px] bg-white border border-slate-200/60 flex items-center justify-center shrink-0 shadow-sm ${byArea ? "text-violet-600" : "text-blue-600"}`}>
                <i className={`ph-fill ${byArea ? "ph-ruler" : "ph-receipt"} text-[1.1rem] sm:text-[1.2rem]`}></i>
              </div>
              <div className="min-w-0">
                <span className="block truncate text-[0.95rem] sm:text-[1.05rem] font-semibold text-slate-800">{row.category as ReactNode}{row.extraText}</span>
                {byArea && (
                  <span className={`block text-[0.7rem] font-semibold ${area ? "text-violet-600" : "text-amber-600"}`}>
                    {area ? `${area.toLocaleString("en-IN")} ${unitText}${parseQuantity(row.qty) !== 1 ? ` × ${parseQuantity(row.qty).toLocaleString("en-IN")} = ${(area * parseQuantity(row.qty)).toLocaleString("en-IN")} ${unitText}` : ""}` : `Priced per ${unitText}: enter the size as width x height, e.g. 10 x 6`}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-4 sm:gap-6">
              <div className="flex flex-col items-end">
                <span className="text-[0.65rem] text-slate-400 font-bold uppercase tracking-widest leading-none mb-1">{byArea ? `Rate / ${unitText}` : "Rate"}</span>
                <div className="flex items-center relative w-[90px] sm:w-[110px]">
                  <div className="absolute inset-y-0 left-0 pl-2 sm:pl-3 flex items-center pointer-events-none">
                    <span className="text-slate-400 font-medium text-[0.9rem]">₹</span>
                  </div>
                  <input
                    type="text"
                    className="flex h-[34px] sm:h-[36px] w-full rounded-lg bg-white border border-slate-200 pl-6 sm:pl-7 pr-2 py-1 text-[0.95rem] font-semibold text-slate-700 text-right transition-colors focus-visible:outline-none focus-visible:border-blue-500 focus-visible:ring-1 focus-visible:ring-blue-500"
                    value={financialRates[row.rateKey] || ""}
                    onChange={(e) => {
                      const val = amountOnly(e.target.value);
                      setFinancialRates((prev) => ({ ...prev, [row.rateKey]: val }));
                    }}
                    placeholder="0"
                  />
                </div>
              </div>
              <div className="w-[1px] h-[30px] bg-slate-200 mt-3"></div>
              <div className="flex flex-col items-end min-w-[70px] sm:min-w-[90px] pr-1">
                <span className="text-[0.65rem] text-slate-400 font-bold uppercase tracking-widest leading-none mb-1.5">Total</span>
                <span data-testid="rate-line-total" className="text-[1.05rem] font-bold text-slate-800 leading-none">
                  ₹ {lineItemTotal(financialRates[row.rateKey], row.qty, unit, row.size).toLocaleString("en-IN")}
                </span>
              </div>
            </div>
          </div>
          );
        })}

        {/* Sum of Line Items Row */}
        {sum > 0 && (
          <div className="flex items-center justify-end px-2.5 sm:px-3 pt-2 pb-1">
            <div className="flex items-center gap-4 sm:gap-6">
              <div className="flex flex-col items-end min-w-[70px] sm:min-w-[90px] pr-1">
                <span className="text-[1.15rem] font-black text-slate-800 leading-none">₹ {sum.toLocaleString("en-IN")}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
