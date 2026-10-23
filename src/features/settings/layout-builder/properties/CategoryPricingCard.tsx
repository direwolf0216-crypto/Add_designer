"use client";

import { useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { fetcher } from "@/lib/swr";
import { optionLabels } from "@/lib/forms/options";
import { pricingRuleFor, pricingUnitOptions, type PricingRule, type PricingRules } from "@/lib/jobs/pricing";
import type { FormField, FormLayout } from "@/lib/layout-builder/types";
import RateUnitField from "@/components/settings/pricing/PricingUnitPicker";
import { useSystem } from "@/components/providers/SystemProvider";

/**
 * Pricing per option of the category field, editable right here (same setting as Settings → Pricing).
 * The area units offered are this layout's Size field units.
 */
export default function CategoryPricingCard({ field, layout }: { field: FormField; layout: FormLayout["schema"] }) {
  const { data, mutate } = useSWR<{ pricing_rules?: PricingRules }>("/api/settings/system", fetcher, { revalidateOnFocus: false });
  const { preferences } = useSystem();
  const currency = preferences?.currencySymbol || "₹";
  const [draft, setDraft] = useState<PricingRules | null>(null);
  const [rateText, setRateText] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const rules = draft ?? data?.pricing_rules ?? {};
  const options = optionLabels(field.options ?? []);
  const unitOptions = pricingUnitOptions(layout);
  if (options.length === 0) return null;

  const keyFor = (c: string) => Object.keys(rules).find((k) => k.trim().toLowerCase() === c.trim().toLowerCase()) ?? c;
  const update = (c: string, patch: Partial<PricingRule>) => {
    const next: PricingRules = { ...rules };
    const rule: PricingRule = { ...pricingRuleFor(rules, c), ...patch };
    if (!rule.sizeUnit) delete rule.sizeUnit;
    if (rule.defaultRate === undefined) delete rule.defaultRate;
    next[keyFor(c)] = rule;
    setDraft(next);
  };
  const discard = () => {
    setDraft(null);
    setRateText({});
  };
  const save = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const res = await fetch("/api/settings/system", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: "pricing_rules", value: draft }) });
      if (!res.ok) throw new Error("Couldn't save pricing");
      await mutate();
      discard();
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
          const r = pricingRuleFor(rules, c);
          return (
            <li key={c} className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-2.5 py-1.5">
              <span className="min-w-0 flex-1 truncate text-[0.8rem] font-bold text-slate-700" title={c}>{c}</span>
              <div className="w-[9.5rem] shrink-0">
                <RateUnitField
                  small
                  options={unitOptions}
                  rule={r}
                  currency={currency}
                  category={c}
                  rate={rateText[c] ?? (r.defaultRate ?? "").toString()}
                  onRate={(v) => {
                    setRateText((prev) => ({ ...prev, [c]: v }));
                    update(c, { defaultRate: v === "" ? undefined : parseFloat(v) || 0 });
                  }}
                  onUnit={(patch) => update(c, patch)}
                />
              </div>
            </li>
          );
        })}
      </ul>
      {draft && (
        <div className="mt-2 flex items-center justify-end gap-2">
          <button type="button" onClick={discard} className="rounded-lg px-3 py-1.5 text-[0.72rem] font-bold text-slate-500 hover:bg-slate-100">Discard</button>
          <button type="button" onClick={save} disabled={saving} className="rounded-lg bg-slate-900 px-3 py-1.5 text-[0.72rem] font-bold text-white hover:bg-slate-800 disabled:opacity-50">{saving ? "Saving…" : "Save pricing"}</button>
        </div>
      )}
      <p className="mt-2 text-[0.7rem] text-slate-500 leading-snug">
        {unitOptions.areas.length > 0
          ? "Area options come from this layout's Size field units. Area lines multiply the rate by the size's area."
          : "Add a Size field to this layout to price categories by area."}{" "}
        Pricing is saved on its own, not with the layout draft.
      </p>
    </div>
  );
}
