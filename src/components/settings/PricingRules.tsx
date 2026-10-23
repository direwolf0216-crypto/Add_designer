"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { fetcher } from "@/lib/swr";
import { findRoleField } from "@/lib/forms/roles";
import { optionLabels } from "@/lib/forms/options";
import type { FormLayout } from "@/lib/forms/types";
import { composeSize, defaultUnitFor, isAreaUnit, isSizeLayoutField } from "@/lib/jobs/size";
import {
  isAreaPricing,
  lineMultiplier,
  parseQuantity,
  pricingRuleFor,
  pricingUnitLabel,
  ruleSizeUnit,
  pricingUnitOptions,
  type PricingRule,
  type PricingRules as Rules,
} from "@/lib/jobs/pricing";
import { useSystem } from "@/components/providers/SystemProvider";
import CustomDropdown from "@/components/ui/CustomDropdown";
import { useSettingsUnsaved } from "@/lib/settings/leaveGuard";
import RateUnitField, { areaText, ruleUnitText } from "./pricing/PricingUnitPicker";

/** Options of the job form's category field (the field holding the Job category role). */
function categoriesOf(schema: FormLayout | undefined): string[] {
  const field = findRoleField(schema, "category");
  return field?.options ? optionLabels(field.options).filter(Boolean) : [];
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
const money = (n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: 2 });

/**
 * Settings → Pricing: per job category, whether the rate is per piece or per unit of area, and an
 * optional default rate. Categories come from the Job category field and the area units from the Size
 * field (Layouts & Fields), so nothing here is fixed.
 */
export default function PricingRules() {
  const { data: layout } = useSWR<{ schema?: FormLayout }>("/api/settings/layouts/JOB_FORM", fetcher, { revalidateOnFocus: false });
  const { data: system, mutate, isLoading } = useSWR<{ pricing_rules?: Rules }>("/api/settings/system", fetcher, { revalidateOnFocus: false });
  const { preferences } = useSystem();
  const currency = preferences?.currencySymbol || "₹";

  const [draft, setDraft] = useState<Rules | null>(null);
  // What is typed in each rate box, so "12." survives until the next digit.
  const [rateText, setRateText] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");

  const schema = layout?.schema;
  const categories = useMemo(() => categoriesOf(schema), [schema]);
  const unitOptions = useMemo(() => pricingUnitOptions(schema), [schema]);
  const sizeField = useMemo(() => (schema?.sections ?? []).flatMap((s) => s.fields ?? []).find((f) => isSizeLayoutField(f)), [schema]);

  const saved = useMemo(() => system?.pricing_rules ?? {}, [system]);
  const rules = draft ?? saved;
  // Categories that have a rule but are no longer in the form still show, so they can be cleared.
  const orphans = Object.keys(rules).filter((k) => !categories.some((c) => same(c, k)));
  const all = [...categories, ...orphans];
  const changed = (c: string) => JSON.stringify(pricingRuleFor(rules, c)) !== JSON.stringify(pricingRuleFor(saved, c));
  const changedCount = [...new Set([...all, ...Object.keys(saved)])].filter(changed).length;
  const dirty = changedCount > 0;
  useSettingsUnsaved(dirty);

  const keyFor = (c: string) => Object.keys(rules).find((k) => same(k, c)) ?? c;
  const setRule = (c: string, rule: PricingRule | null) => {
    const next = { ...rules };
    const key = keyFor(c);
    // A per-piece rule without a rate is the default, so it isn't stored.
    if (!rule || (rule.unit === "piece" && !rule.defaultRate && !rule.sizeUnit)) delete next[key];
    else next[key] = rule;
    setDraft(next);
  };

  const discard = () => {
    setDraft(null);
    setRateText({});
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/settings/system", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: "pricing_rules", value: rules }) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Couldn't save pricing");
      await mutate();
      discard();
      toast.success("Pricing saved", { description: "New and edited jobs use these rules right away." });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const visible = query.trim() ? all.filter((c) => c.toLowerCase().includes(query.trim().toLowerCase())) : all;
  const byArea = all.filter((c) => isAreaPricing(pricingRuleFor(rules, c).unit)).length;
  const withRate = all.filter((c) => !!pricingRuleFor(rules, c).defaultRate).length;
  const loading = (isLoading && !system) || !layout;

  return (
    <div className="relative flex flex-col gap-3 animate-[fadeIn_0.3s_ease-out]">
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-3.5 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-pink-500 text-white shadow-md shadow-orange-500/25">
              <i className="ph-fill ph-tag text-lg" aria-hidden="true"></i>
            </span>
            <div className="min-w-0">
              <h2 className="text-base font-bold leading-tight text-slate-900">Pricing</h2>
              <p className="truncate text-xs text-slate-500" title="Pick how each category is charged and the rate new jobs start with. Typing a rate on a job always wins.">How each category is charged and the rate new jobs start with.</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Stat icon="ph-squares-four" tone="from-orange-500 to-amber-400" label="Categories" value={all.length} loading={loading} />
            <Stat icon="ph-ruler" tone="from-violet-600 to-fuchsia-500" label="By area" value={byArea} loading={loading} />
            <Stat icon="ph-currency-inr" tone="from-emerald-500 to-teal-400" label="With a rate" value={withRate} loading={loading} />
          </div>
          <SizeSource options={unitOptions} />
        </div>

        {!loading && all.length > 0 ? (
          <Calculator categories={all} rules={rules} options={unitOptions} defaultSizeUnit={defaultUnitFor(sizeField)} currency={currency} />
        ) : (
          <div className="hidden animate-pulse rounded-2xl bg-white/60 xl:block" aria-hidden="true" />
        )}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-400">Categories</h3>
          {all.length > 4 && (
            <label className="relative block sm:w-64">
              <i className="ph-bold ph-magnifying-glass pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true"></i>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search categories"
                aria-label="Search categories"
                className="w-full rounded-xl border border-gray-200 bg-slate-50/60 py-2 pl-9 pr-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-orange-400 focus:bg-white focus:ring-2 focus:ring-orange-500/15 placeholder:font-normal placeholder:text-slate-400"
              />
            </label>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] gap-2">{[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="h-[4.75rem] animate-pulse rounded-xl bg-slate-100" />)}</div>
        ) : all.length === 0 ? (
          <Empty icon="ph-squares-four" title="No job categories yet" text="Add options to the Job category field under Layouts & Fields, then set their pricing here." link />
        ) : visible.length === 0 ? (
          <Empty icon="ph-magnifying-glass" title="No matches" text={`No category matches "${query.trim()}".`} />
        ) : (
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] gap-2">
            {visible.map((c) => {
              const r = pricingRuleFor(rules, c);
              const area = isAreaPricing(r.unit);
              const orphan = orphans.includes(c);
              const edited = changed(c);
              return (
                <li
                  key={c}
                  data-testid="pricing-row"
                  data-category={c}
                  className={`flex flex-col gap-2 rounded-xl border p-2.5 transition-colors ${orphan ? "border-amber-200 bg-amber-50/60" : edited ? "border-orange-200 bg-orange-50/50" : "border-slate-200 bg-white hover:border-slate-300"}`}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-gradient-to-br text-white ${area ? "from-violet-600 to-fuchsia-500" : "from-blue-600 to-sky-500"}`}>
                      <i className={`ph-fill ${area ? "ph-ruler" : "ph-receipt"} text-[0.75rem]`} aria-hidden="true"></i>
                    </span>
                    <p className="min-w-0 flex-1 truncate text-[0.82rem] font-bold text-slate-800" title={c}>{c}</p>
                    {edited && !orphan && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-orange-500" title="Edited, not saved yet" aria-label="Edited"></span>}
                    {orphan && <span className="shrink-0 rounded bg-amber-100 px-1 py-0.5 text-[0.55rem] font-bold uppercase text-amber-700">Not in form</span>}
                  </div>
                  {orphan ? (
                    <button type="button" onClick={() => setRule(c, null)} className="inline-flex items-center justify-center gap-1 rounded-lg border border-amber-200 bg-white py-1.5 text-xs font-bold text-amber-700 hover:bg-amber-50">
                      <i className="ph-bold ph-x" aria-hidden="true"></i>Clear rule
                    </button>
                  ) : (
                    <RateUnitField
                      options={unitOptions}
                      rule={r}
                      currency={currency}
                      category={c}
                      rate={rateText[c] ?? (r.defaultRate ?? "").toString()}
                      onRate={(v) => {
                        setRateText((prev) => ({ ...prev, [c]: v }));
                        const next: PricingRule = { ...r, defaultRate: parseFloat(v) || 0 };
                        if (!v) delete next.defaultRate;
                        setRule(c, next);
                      }}
                      onUnit={(patch) => {
                        const next: PricingRule = { ...r, ...patch };
                        if (!next.sizeUnit) delete next.sizeUnit;
                        setRule(c, next);
                      }}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {dirty && (
        <div className="sticky bottom-[calc(1rem+env(safe-area-inset-bottom))] z-20 animate-[slideUp_0.25s_cubic-bezier(0.16,1,0.3,1)]">
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900/95 px-4 py-3 text-white shadow-2xl shadow-slate-900/30 backdrop-blur">
            <span className="flex min-w-0 items-center gap-2 text-sm font-bold">
              <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-orange-400" aria-hidden="true"></span>
              <span className="truncate">{changedCount} unsaved {changedCount === 1 ? "change" : "changes"}</span>
            </span>
            <div className="flex shrink-0 items-center gap-2">
              <button type="button" onClick={discard} disabled={saving} className="rounded-xl px-3 py-2 text-sm font-bold text-slate-300 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50">Discard</button>
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-pink-500 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-orange-500/30 transition-transform active:scale-[0.97] disabled:opacity-60"
              >
                <i className={`ph-bold ${saving ? "ph-circle-notch animate-spin" : "ph-floppy-disk"}`} aria-hidden="true"></i>
                {saving ? "Saving…" : "Save pricing"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ icon, tone, label, value, loading }: { icon: string; tone: string; label: string; value: number; loading: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-xl border border-slate-100 bg-slate-50/70 px-2 py-1.5">
      <span className={`hidden h-6 w-6 shrink-0 items-center justify-center rounded-md bg-gradient-to-br text-white sm:flex ${tone}`}>
        <i className={`ph-fill ${icon} text-[0.75rem]`} aria-hidden="true"></i>
      </span>
      <p className="min-w-0 truncate text-[0.6rem] font-bold uppercase tracking-wide text-slate-400 sm:text-[0.68rem]">
        <span className="mr-1 text-sm font-black normal-case tracking-normal text-slate-900 tabular-nums">{loading ? "–" : value}</span>
        {label}
      </p>
    </div>
  );
}

/** Where the area units come from: the Size field's units, with a link to change them. */
function SizeSource({ options }: { options: ReturnType<typeof pricingUnitOptions> }) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-xl border border-violet-100 bg-gradient-to-r from-violet-50 to-fuchsia-50/60 px-2.5 py-1.5 text-xs">
      <i className="ph-fill ph-ruler shrink-0 text-violet-500" aria-hidden="true"></i>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
        {options.hasSizeField ? (
          <>
            <span className="font-bold text-violet-900">Size units:</span>
            {options.sizeUnits.map((u) => (
              <span
                key={u}
                title={options.unmeasurable.includes(u) ? `${u} can't be measured as an area, so lines in it price per piece` : undefined}
                className={`rounded bg-white px-1.5 py-0.5 text-[0.68rem] font-extrabold shadow-sm ${options.unmeasurable.includes(u) ? "text-slate-400" : "text-violet-700"}`}
              >
                {u}
              </span>
            ))}
          </>
        ) : (
          <span className="font-bold text-violet-900">Add a Size field to the job form to price by area.</span>
        )}
      </div>
      <a href="/settings?section=layouts" className="inline-flex shrink-0 items-center gap-0.5 rounded-md bg-white px-2 py-1 text-[0.68rem] font-bold text-violet-700 shadow-sm transition-colors hover:bg-violet-100">
        Edit<i className="ph-bold ph-arrow-up-right" aria-hidden="true"></i>
      </a>
    </div>
  );
}

/** Try a line: category, size (in the Size field's units) and quantity, priced with the rules being edited. */
function Calculator({ categories, rules, options, defaultSizeUnit, currency }: { categories: string[]; rules: Rules; options: ReturnType<typeof pricingUnitOptions>; defaultSizeUnit: string; currency: string }) {
  const [category, setCategory] = useState(categories[0]);
  const [dims, setDims] = useState("10 x 6");
  const [sizeUnit, setSizeUnit] = useState(options.sizeUnits.includes(defaultSizeUnit) ? defaultSizeUnit : options.sizeUnits[0] ?? "ft");
  const [qty, setQty] = useState("1");

  const cat = categories.some((c) => c === category) ? category : categories[0];
  const rule = pricingRuleFor(rules, cat);
  const area = isAreaPricing(rule.unit);
  const size = composeSize(dims, sizeUnit);
  const { multiplier, area: measured } = lineMultiplier(rule.unit, qty, size);
  const q = parseQuantity(qty);
  const rate = rule.defaultRate ?? 0;
  const total = rate * multiplier;
  const unitText = ruleUnitText(rule, options);
  const shownArea = ruleSizeUnit(rule, options);
  const areaLabel = shownArea ? areaText(shownArea) : pricingUnitLabel(rule.unit);

  return (
    <div data-testid="pricing-calculator" className="flex min-w-0 flex-col gap-2.5 rounded-2xl border border-gray-200 bg-white p-3.5 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-emerald-500 to-teal-400 text-white">
          <i className="ph-fill ph-calculator text-[0.75rem]" aria-hidden="true"></i>
        </span>
        <h3 className="text-sm font-extrabold text-slate-800">Try a price</h3>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_3.75rem] gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_3.75rem]">
        <div className="col-span-2 min-w-0 sm:col-span-1">
          <CustomDropdown options={categories} value={cat} onChange={setCategory} className="h-9 rounded-lg px-2.5 text-sm" />
        </div>
        <div className="flex min-w-0 overflow-hidden rounded-lg border border-gray-200 focus-within:border-orange-400 focus-within:ring-2 focus-within:ring-orange-500/15">
          <input
            value={dims}
            onChange={(e) => setDims(e.target.value)}
            placeholder={isAreaUnit(sizeUnit) ? "e.g. 60" : "10 x 6"}
            aria-label="Size"
            className="min-w-0 flex-1 bg-transparent px-2.5 text-sm font-semibold text-slate-800 outline-none"
          />
          {options.sizeUnits.length > 0 && (
            <div className="w-[4.25rem] shrink-0 border-l border-gray-100">
              <CustomDropdown options={options.sizeUnits} value={sizeUnit} onChange={setSizeUnit} className="h-9 rounded-none border-0 bg-slate-50 px-2 text-xs font-bold focus:ring-0" />
            </div>
          )}
        </div>
        <input
          inputMode="numeric"
          value={qty}
          onChange={(e) => setQty(e.target.value.replace(/[^0-9.,]/g, ""))}
          aria-label="Qty"
          title="Quantity"
          className="h-9 w-full rounded-lg border border-gray-200 px-2 text-right text-sm font-semibold text-slate-800 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-500/15"
        />
      </div>

      <div className="flex items-center justify-between gap-3 rounded-xl bg-gradient-to-r from-slate-900 to-slate-800 px-3 py-2 text-white">
        <p data-testid="calc-breakdown" className="min-w-0 text-xs font-semibold text-slate-300">
          {area && !measured ? (
            <span className="text-amber-300">Can&apos;t measure this size, so it prices per piece.</span>
          ) : area ? (
            <>
              {money(measured!)} {areaLabel}
              {q !== 1 && <> × {money(q)}</>} × {currency}{money(rate)} / {unitText}
            </>
          ) : (
            <>{money(q)} × {currency}{money(rate)} / piece</>
          )}
          {!rule.defaultRate && <span className="block text-[0.68rem] text-slate-400">No default rate for {cat} yet.</span>}
        </p>
        <p data-testid="calc-total" className="shrink-0 text-lg font-black tabular-nums">{currency}{money(total)}</p>
      </div>
    </div>
  );
}

function Empty({ icon, title, text, link }: { icon: string; title: string; text: string; link?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-200 p-8 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-400"><i className={`ph-bold ${icon} text-xl`} aria-hidden="true"></i></span>
      <p className="text-sm font-bold text-slate-700">{title}</p>
      <p className="max-w-sm text-sm text-slate-500">{text}</p>
      {link && <a href="/settings?section=layouts" className="mt-1 text-sm font-bold text-orange-600 hover:text-orange-700">Open Layouts &amp; Fields</a>}
    </div>
  );
}
