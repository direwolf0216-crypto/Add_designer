"use client";

import CustomDropdown from "@/components/ui/CustomDropdown";
import { isAreaPricing, pricingUnitLabel, ruleSizeUnit, type PricingRule, type PricingUnitOptions } from "@/lib/jobs/pricing";
import { isAreaUnit } from "@/lib/jobs/size";

/** "ft²" for a length unit, the unit itself for one that already is an area ("sqft"). */
export const areaText = (sizeUnit: string) => (isAreaUnit(sizeUnit) ? sizeUnit : `${sizeUnit}²`);

/** How a rule's unit reads in Settings: the Size-field unit ("cm"), "piece", or the area name when the Size field dropped it. */
export function ruleUnitText(rule: PricingRule, options: PricingUnitOptions): string {
  return ruleSizeUnit(rule, options) ?? pricingUnitLabel(rule.unit);
}

/** "Rate × qty", or "Rate × area in cm² × qty". */
export function ruleFormula(rule: PricingRule, options: PricingUnitOptions): string {
  if (!isAreaPricing(rule.unit)) return "Rate × qty";
  const shown = ruleSizeUnit(rule, options);
  return `Rate × area in ${shown ? areaText(shown) : pricingUnitLabel(rule.unit)} × qty`;
}

/**
 * A default rate with its unit picked right beside it ("₹ 25 / ft"). The units are "piece" plus the
 * Size field's own units from Layouts & Fields; a length unit prices by area in that unit, and one that
 * can't be measured (e.g. "pcs") prices per piece.
 */
export default function RateUnitField({
  options,
  rule,
  currency,
  rate,
  category,
  onRate,
  onUnit,
  small = false,
}: {
  options: PricingUnitOptions;
  rule: PricingRule;
  currency: string;
  rate: string;
  category: string;
  onRate: (text: string) => void;
  onUnit: (patch: Pick<PricingRule, "unit" | "sizeUnit">) => void;
  small?: boolean;
}) {
  const shown = ruleSizeUnit(rule, options);
  const value = shown ? `size:${shown}` : isAreaPricing(rule.unit) ? `stale:${rule.unit}` : "piece";
  const choices = [
    { value: "piece", label: "/ piece" },
    ...options.choices.map((c) => ({ value: `size:${c.sizeUnit}`, label: `/ ${c.sizeUnit}` })),
    ...(value.startsWith("stale:") ? [{ value, label: `/ ${pricingUnitLabel(rule.unit)} (removed)` }] : []),
  ];
  const pick = (v: string) => {
    if (v === "piece") return onUnit({ unit: "piece", sizeUnit: undefined });
    const choice = options.choices.find((c) => `size:${c.sizeUnit}` === v);
    if (choice) onUnit({ unit: choice.unit, sizeUnit: choice.sizeUnit });
  };
  const area = isAreaPricing(rule.unit);
  return (
    <div
      title={ruleFormula(rule, options)}
      className={`flex w-full items-stretch overflow-hidden rounded-lg border bg-white transition focus-within:border-orange-400 focus-within:ring-2 focus-within:ring-orange-500/15 ${area ? "border-violet-200" : "border-gray-200"}`}
    >
      <span className={`flex items-center pl-2.5 font-bold text-slate-400 ${small ? "text-[0.72rem]" : "text-sm"}`}>{currency}</span>
      <input
        inputMode="decimal"
        value={rate}
        onChange={(e) => onRate(e.target.value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1"))}
        placeholder="0"
        aria-label={`Default rate for ${category}`}
        className={`min-w-0 flex-1 bg-transparent px-1.5 text-right font-bold text-slate-800 outline-none placeholder:font-normal placeholder:text-slate-300 ${small ? "py-1 text-[0.78rem]" : "py-1.5 text-sm"}`}
      />
      <div className={`shrink-0 border-l ${area ? "border-violet-100" : "border-gray-100"} ${small ? "w-[4.5rem]" : "w-[5.25rem]"}`} data-testid="pricing-unit">
        <CustomDropdown
          options={choices}
          value={value}
          onChange={pick}
          className={`h-full rounded-none border-0 px-2 font-bold focus:ring-0 ${small ? "text-[0.7rem]" : "text-xs"} ${area ? "bg-violet-50 text-violet-700" : "bg-slate-50 text-slate-600"}`}
        />
      </div>
    </div>
  );
}
