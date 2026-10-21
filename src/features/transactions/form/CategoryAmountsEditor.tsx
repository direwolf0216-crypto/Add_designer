"use client";

import { categoryAmountsTotal, type TransactionFormValues } from "@/lib/transactions/formMapping";

/** With several categories selected: one amount per category (`amount_<category>`) and their total. */
export default function CategoryAmountsEditor({
  categories,
  form,
  errors,
  set,
}: {
  categories: string[];
  form: TransactionFormValues;
  errors: Record<string, string>;
  set: (key: string) => (value: string) => void;
}) {
  if (categories.length <= 1) return null;

  return (
    <div className="mt-4 space-y-2 bg-slate-50/50 p-3 rounded-xl border border-slate-100">
      <div className="flex items-center justify-between mb-3">
        <label className="block text-[10px] font-extrabold text-slate-500 tracking-[1.5px] uppercase">Amounts per category</label>
        <div className="text-xs font-bold text-slate-700 bg-white px-2 py-1 rounded-md border border-slate-200 shadow-sm">
          Total: <span className="text-emerald-600">₹{categoryAmountsTotal(form, categories).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
      </div>
      {categories.map((cat) => {
        const err = errors[`amount_${cat}`];
        return (
          <div key={cat} className="flex items-center gap-3">
            <div className="text-sm font-bold text-slate-700 w-1/3 truncate bg-slate-50 px-3 py-2.5 rounded-lg border border-slate-100" title={cat}>{cat}</div>
            <div className={`flex-1 bg-white rounded-xl border px-3 py-2 flex items-center gap-2 focus-within:ring-2 focus-within:ring-orange-500/20 shadow-sm ${err ? "border-red-400 focus-within:border-red-400" : "border-slate-200 focus-within:border-orange-400"}`}>
              <span className="text-slate-400 font-medium">₹</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form[`amount_${cat}`] || ""}
                onChange={(e) => set(`amount_${cat}`)(e.target.value)}
                placeholder="0.00"
                className="w-full bg-transparent border-none outline-none text-sm font-bold text-slate-900 placeholder:text-slate-300"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
