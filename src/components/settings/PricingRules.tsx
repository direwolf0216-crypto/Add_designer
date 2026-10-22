"use client";

import { useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { fetcher } from "@/lib/swr";
import { parseAreaSqFt, type PricingRule, type PricingRules as Rules } from "@/lib/jobs/pricing";

type Layout = { schema?: { sections?: { fields?: { id?: string; options?: unknown[] }[] }[] } };

function categoriesOf(layout: Layout | undefined): string[] {
  for (const s of layout?.schema?.sections ?? []) {
    for (const f of s.fields ?? []) {
      if (f.id === "fld_b_job_category" && Array.isArray(f.options)) {
        return f.options.map((o) => (typeof o === "string" ? o : (o as { label?: string })?.label)).filter((o): o is string => !!o);
      }
    }
  }
  return [];
}

/**
 * Settings → Pricing: per job category, whether the rate is per piece or per square foot, and an
 * optional default rate. Nothing is hard-coded: Flex Printing is per sq ft only if switched on here.
 */
export default function PricingRules() {
  const { data: layout } = useSWR<Layout>("/api/settings/layouts/JOB_FORM", fetcher, { revalidateOnFocus: false });
  const { data: system, mutate, isLoading } = useSWR<{ pricing_rules?: Rules }>("/api/settings/system", fetcher, { revalidateOnFocus: false });
  const [draft, setDraft] = useState<Rules | null>(null);
  const [saving, setSaving] = useState(false);
  const [sample, setSample] = useState("10 x 6");

  const saved = system?.pricing_rules ?? {};
  const rules = draft ?? saved;
  const categories = categoriesOf(layout);
  // Categories that have a rule but are no longer in the form still show, so they can be cleared.
  const all = [...categories, ...Object.keys(rules).filter((k) => !categories.some((c) => c.toLowerCase() === k.toLowerCase()))];
  const dirty = JSON.stringify(rules) !== JSON.stringify(saved);

  const ruleFor = (c: string): PricingRule => rules[c] ?? { unit: "piece" };
  const setRule = (c: string, rule: PricingRule | null) => {
    const next = { ...rules };
    if (!rule || (rule.unit === "piece" && !rule.defaultRate)) delete next[c];
    else next[c] = rule;
    setDraft(next);
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/settings/system", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: "pricing_rules", value: rules }) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Couldn't save pricing");
      await mutate();
      setDraft(null);
      toast.success("Pricing saved", { description: "New and edited jobs use these rules right away." });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const sampleArea = parseAreaSqFt(sample);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 animate-[fadeIn_0.3s_ease-out]">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-[1.15rem] font-bold text-slate-900 mb-1">Pricing</h2>
          <p className="text-sm text-slate-500">Choose, per category, whether the rate is per piece or per square foot, and set a default rate to pre-fill on new jobs.</p>
        </div>
        <button
          type="button"
          onClick={save}
          disabled={saving || !dirty}
          className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <i className={`ph-bold ${saving ? "ph-circle-notch animate-spin" : "ph-floppy-disk"}`} aria-hidden="true"></i>
          {saving ? "Saving…" : dirty ? "Save pricing" : "Saved"}
        </button>
      </div>

      <div className="mb-5 flex flex-col gap-2 rounded-2xl border border-violet-100 bg-violet-50/60 p-4 text-sm text-violet-900 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-bold">How per-square-foot pricing works</p>
          <p className="text-[0.8rem] text-violet-800/80">Line total = rate × area × quantity. The area comes from the item&apos;s Size, written as width x height in feet (or with in / cm / m after the numbers).</p>
        </div>
        <label className="flex items-center gap-2 text-[0.8rem] font-semibold">
          Try a size
          <input value={sample} onChange={(e) => setSample(e.target.value)} className="w-28 rounded-lg border border-violet-200 bg-white px-2 py-1 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-300" />
          <span className="whitespace-nowrap font-black">{sampleArea ? `${sampleArea.toLocaleString("en-IN")} sq ft` : "not readable"}</span>
        </label>
      </div>

      {isLoading && !system ? (
        <div className="flex flex-col gap-2">{[0, 1, 2].map((i) => <div key={i} className="h-14 animate-pulse rounded-2xl bg-slate-100" />)}</div>
      ) : all.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">No job categories yet. Add options to the Job Category field under Layouts &amp; Fields first.</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-100">
          <div className="hidden grid-cols-[minmax(0,1fr)_200px_160px] gap-3 bg-slate-50 px-4 py-2 text-[0.65rem] font-extrabold uppercase tracking-wider text-slate-400 sm:grid">
            <span>Category</span><span>Priced</span><span className="text-right">Default rate</span>
          </div>
          {all.map((c) => {
            const r = ruleFor(c);
            const sqft = r.unit === "sqft";
            return (
              <div key={c} className="grid grid-cols-1 gap-3 border-t border-slate-100 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_200px_160px] sm:items-center">
                <div className="flex items-center gap-2 min-w-0">
                  <i className={`ph-fill ${sqft ? "ph-ruler text-violet-500" : "ph-receipt text-blue-500"}`} aria-hidden="true"></i>
                  <span className="truncate text-sm font-bold text-slate-800">{c}</span>
                  {!categories.some((x) => x.toLowerCase() === c.toLowerCase()) && <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[0.6rem] font-bold uppercase text-amber-600">not in form</span>}
                </div>
                <div role="radiogroup" aria-label={`${c} pricing`} className="inline-flex w-fit rounded-xl bg-slate-100 p-1">
                  {(["piece", "sqft"] as const).map((u) => (
                    <button
                      key={u}
                      type="button"
                      role="radio"
                      aria-checked={r.unit === u}
                      onClick={() => setRule(c, { ...r, unit: u })}
                      className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${r.unit === u ? (u === "sqft" ? "bg-violet-600 text-white shadow-sm" : "bg-white text-slate-900 shadow-sm") : "text-slate-500 hover:text-slate-800"}`}
                    >
                      {u === "sqft" ? "Per sq ft" : "Per piece"}
                    </button>
                  ))}
                </div>
                <label className="flex items-center justify-end gap-2 text-xs font-semibold text-slate-500">
                  <span className="sm:hidden">Default rate</span>
                  <span className="text-slate-400">₹</span>
                  <input
                    inputMode="decimal"
                    value={r.defaultRate ?? ""}
                    onChange={(e) => {
                      const v = e.target.value.replace(/[^0-9.]/g, "");
                      setRule(c, { unit: r.unit, ...(v ? { defaultRate: parseFloat(v) || 0 } : {}) });
                    }}
                    placeholder="optional"
                    className="w-24 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-right text-sm font-semibold text-slate-800 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-500/15"
                  />
                  <span className="w-12 text-left text-[0.65rem] text-slate-400">{sqft ? "/ sq ft" : "/ piece"}</span>
                </label>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
