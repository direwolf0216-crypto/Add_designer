"use client";

import { useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { fetcher } from "@/lib/swr";
import { optionLabels } from "@/lib/forms/options";
import type { PricingRules, PricingUnit } from "@/lib/jobs/pricing";
import type { FormField } from "@/lib/layout-builder/types";

/** Pricing per option of the category field, editable right here (same setting as Settings → Pricing). */
export default function CategoryPricingCard({ field }: { field: FormField }) {
  const { data, mutate } = useSWR<{ pricing_rules?: PricingRules }>("/api/settings/system", fetcher, { revalidateOnFocus: false });
  const [draft, setDraft] = useState<PricingRules | null>(null);
  const [saving, setSaving] = useState(false);
  const rules = draft ?? data?.pricing_rules ?? {};
  const options = optionLabels(field.options ?? []);
  if (options.length === 0) return null;

  const ruleFor = (c: string) => rules[Object.keys(rules).find((k) => k.trim().toLowerCase() === c.trim().toLowerCase()) ?? c] ?? { unit: "piece" as PricingUnit };
  const update = (c: string, patch: Partial<{ unit: PricingUnit; defaultRate?: number }>) => {
    const next: PricingRules = { ...rules };
    const key = Object.keys(next).find((k) => k.trim().toLowerCase() === c.trim().toLowerCase()) ?? c;
    next[key] = { ...ruleFor(c), ...patch };
    setDraft(next);
  };
  const save = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const res = await fetch("/api/settings/system", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: "pricing_rules", value: draft }) });
      if (!res.ok) throw new Error("Couldn't save pricing");
      await mutate();
      setDraft(null);
      toast.success("Pricing saved", { description: "Applies to new and edited jobs right away; it is separate from the layout draft." });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="pt-4 border-t border-gray-100">
      <div className="flex items-center justify-between mb-2">
        <label className="text-[0.75rem] font-bold text-slate-600 flex items-center gap-1.5">Pricing by category <span className="rounded-md bg-violet-50 border border-violet-200 px-1.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-wider text-violet-700">Live setting</span></label>
        <a href="/settings?section=pricing" className="text-[0.7rem] font-bold text-orange-600 hover:text-orange-700">Open Pricing</a>
      </div>
      <ul className="space-y-1.5">
        {options.map((c) => {
          const r = ruleFor(c);
          return (
            <li key={c} className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-2.5 py-1.5">
              <span className="min-w-0 flex-1 truncate text-[0.8rem] font-bold text-slate-700" title={c}>{c}</span>
              <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 shrink-0">
                {(["piece", "sqft"] as const).map((u) => (
                  <button key={u} type="button" onClick={() => update(c, { unit: u })} className={`rounded-md px-2 py-1 text-[0.68rem] font-bold transition-colors ${r.unit === u ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>
                    {u === "sqft" ? "/ sq ft" : "/ piece"}
                  </button>
                ))}
              </div>
              <div className="relative w-[4.75rem] shrink-0">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[0.72rem] font-bold text-slate-400">₹</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={r.defaultRate ?? ""}
                  onChange={(e) => update(c, { defaultRate: e.target.value.trim() === "" ? undefined : Number(e.target.value) })}
                  placeholder="rate"
                  aria-label={`Default rate for ${c}`}
                  className="w-full rounded-lg border border-gray-300 bg-white py-1 pl-5 pr-1.5 text-[0.78rem] font-semibold text-slate-800 outline-none focus:border-orange-500 placeholder:font-normal placeholder:text-slate-400"
                />
              </div>
            </li>
          );
        })}
      </ul>
      {draft && (
        <div className="mt-2 flex items-center justify-end gap-2">
          <button type="button" onClick={() => setDraft(null)} className="rounded-lg px-3 py-1.5 text-[0.72rem] font-bold text-slate-500 hover:bg-slate-100">Discard</button>
          <button type="button" onClick={save} disabled={saving} className="rounded-lg bg-slate-900 px-3 py-1.5 text-[0.72rem] font-bold text-white hover:bg-slate-800 disabled:opacity-50">{saving ? "Saving…" : "Save pricing"}</button>
        </div>
      )}
      <p className="mt-2 text-[0.7rem] text-slate-500 leading-snug">Per sq ft lines multiply the rate by the Size field&apos;s area. Pricing is saved on its own, not with the layout draft.</p>
    </div>
  );
}
