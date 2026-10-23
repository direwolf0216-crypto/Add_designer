// Job form pricing: line-item rates × quantity − discount = package (grand total); installments
// sum to the advance; due = package − advance. Pure functions, mirrored 1:1 from the job form.
//
// Note: three slightly different "which entry key is the category / quantity" heuristics exist
// (package calculation, rate rows, line-item sum). They are kept separate on purpose so the
// numbers shown and saved do not change.

import { allFields, fieldNameFor } from "@/lib/forms/fieldMap";
import type { FieldMap, FormLayout, FormSection, RepeatableData, RepeatableEntry } from "@/lib/forms/types";
import { isSizeLayoutField, looksLikeSize, unitsFor } from "./size";
import { findRoleField } from "@/lib/forms/roles";

export interface Installment {
  amount: string;
  date: string;
  paymentMode: string;
  /** Existing INCOME transaction this installment edits. */
  transactionId?: string;
}

/** Financial rates per repeatable entry, keyed `rep_<sectionId>_<index>`. */
export type FinancialRates = Record<string, string>;

/**
 * Area units a category can be priced in, with exact square feet per unit of area. The units offered
 * in Settings → Pricing come from the layout's Size field (`pricingUnitOptions`); this table only says
 * how each one converts.
 */
export const AREA_PRICING_UNITS = {
  sqft: { label: "ft²", sqft: 1 },
  sqin: { label: "in²", sqft: 1 / 144 },
  sqcm: { label: "cm²", sqft: 1 / 929.0304 },
  sqmm: { label: "mm²", sqft: 1 / 92903.04 },
  sqm: { label: "m²", sqft: 1 / 0.09290304 },
  sqyd: { label: "yd²", sqft: 9 },
} as const;
export type AreaPricingUnit = keyof typeof AREA_PRICING_UNITS;

/** How a category is priced: per piece (rate × qty) or per unit of area (rate × area × qty). Keyed by category name. */
export type PricingUnit = "piece" | AreaPricingUnit;
export type PricingRule = {
  unit: PricingUnit;
  defaultRate?: number;
  /** The Size-field unit picked in Settings → Pricing ("cm", "ft", "pcs"), shown instead of the area unit's name. */
  sizeUnit?: string;
};
export type PricingRules = Record<string, PricingRule>;

/** Every unit a rule may hold (the server validates against this). */
export const PRICING_UNITS = ["piece", ...Object.keys(AREA_PRICING_UNITS)] as [PricingUnit, ...PricingUnit[]];

export const isPricingUnit = (u: unknown): u is PricingUnit => typeof u === "string" && (PRICING_UNITS as string[]).includes(u);

/** True for units that multiply the rate by the line's area. */
export const isAreaPricing = (u: unknown): u is AreaPricingUnit => typeof u === "string" && u in AREA_PRICING_UNITS;

/** "piece", "ft²", "in²", … for labels like "₹ 25 / in²" (the Size field's unit, squared). */
export const pricingUnitLabel = (u: PricingUnit): string => (isAreaPricing(u) ? AREA_PRICING_UNITS[u].label : "piece");

// Square feet per unit, as sq ft pricing has always used them (metres at 10.7639). Kept as they are so
// a saved sq ft job never changes its total; the other area units convert exactly (AREA_PRICING_UNITS).
const SQFT_PER: Record<string, number> = { ft: 1, feet: 1, foot: 1, "'": 1, in: 1 / 144, inch: 1 / 144, inches: 1 / 144, '"': 1 / 144, cm: 1 / 929.0304, mm: 1 / 92903.04, m: 10.7639, mtr: 10.7639, meter: 10.7639, metre: 10.7639, yd: 9, yard: 9, yards: 9, sqft: 1, sqm: 10.7639 };

/** Square feet per unit of area for sizes given as one number, e.g. "10 sqft" or "2 sqm". */
const SQFT_PER_AREA: Record<string, number> = { sqft: 1, sqf: 1, "ft²": 1, sqm: 10.7639, "m²": 10.7639 };

/** The area unit each size unit measures in (width x height in cm is an area in sq cm). */
const AREA_OF: Record<string, AreaPricingUnit> = {
  ft: "sqft", feet: "sqft", foot: "sqft", "'": "sqft", sqft: "sqft", sqf: "sqft", "ft²": "sqft",
  in: "sqin", inch: "sqin", inches: "sqin", '"': "sqin",
  cm: "sqcm", mm: "sqmm",
  m: "sqm", mtr: "sqm", meter: "sqm", metre: "sqm", sqm: "sqm", "m²": "sqm",
  yd: "sqyd", yard: "sqyd", yards: "sqyd",
};

const own = <T>(table: Record<string, T>, key: string): T | undefined => (Object.prototype.hasOwnProperty.call(table, key) ? table[key] : undefined);
const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** A readable size: the number to convert (width × height, or the area itself) and the unit it was typed in. */
type ParsedSize = { value: number; token: string; single: boolean };

function parseSize(size: unknown): ParsedSize | null {
  if (size === null || size === undefined) return null;
  const text = String(size).trim().toLowerCase().replace(/×/g, "x").replace(/sq\.?\s*(ft|m)\b/g, "sq$1");
  // A plain area: "10 sqft", "2.5 sqm".
  const area1 = text.match(/^(\d+(?:\.\d+)?)\s*(sqft|sqf|ft²|sqm|m²)$/);
  if (area1) return { value: parseFloat(area1[1]), token: area1[2], single: true };
  const m = text.match(/^(\d+(?:\.\d+)?)\s*([a-z'"]+)?\s*[x*]\s*(\d+(?:\.\d+)?)\s*([a-z'"]+)?\s*(?:sq\.?\s*ft)?$/);
  if (!m) return null;
  const token = m[4] || m[2] || "ft";
  // A unit the shop defined itself (e.g. "pcs") has no area: the line prices per piece.
  if (own(SQFT_PER, token) === undefined) return null;
  return { value: parseFloat(m[1]) * parseFloat(m[3]), token, single: false };
}

/**
 * Area in square feet from a size like "10 x 10", "4*6 ft", "3.5 x 2 in" or "120 x 60 cm". Feet when no unit
 * is given; a unit after either number applies to both. Null when the size isn't two numbers.
 */
export function parseAreaSqFt(size: unknown): number | null {
  const p = parseSize(size);
  if (!p) return null;
  const factor = p.single ? own(SQFT_PER_AREA, p.token)! : own(SQFT_PER, p.token)!;
  const area = p.value * factor;
  return Number.isFinite(area) && area > 0 ? round3(area) : null;
}

/**
 * Area of a size in any area unit, rounded to 3 decimals. Sq ft is exactly `parseAreaSqFt` (saved jobs
 * keep their totals); other units convert exactly, so 3.5 x 2 in is 7 sq in and 1 x 1 m is 10,000 sq cm.
 */
export function areaIn(size: unknown, unit: AreaPricingUnit): number | null {
  if (unit === "sqft") return parseAreaSqFt(size);
  const p = parseSize(size);
  if (!p) return null;
  const from = own(AREA_OF, p.token)!;
  const area = from === unit ? p.value : (p.value * AREA_PRICING_UNITS[from].sqft) / AREA_PRICING_UNITS[unit].sqft;
  return Number.isFinite(area) && area > 0 && round3(area) > 0 ? round3(area) : null;
}

/** The area unit a Size-field unit is measured in ("in" → sq in, "sqm" → sq m), or null when sizes in it can't be measured. */
export function areaUnitForSizeUnit(sizeUnit: string): AreaPricingUnit | null {
  const u = sizeUnit.trim().toLowerCase().replace(/\s+/g, "").replace(/^sq\.?(ft|m)$/, "sq$1");
  return own(AREA_OF, u) ?? null;
}

/** The pricing rule for a category (case-insensitive), per piece when none is set. */
export function pricingRuleFor(rules: PricingRules | null | undefined, category: unknown): PricingRule {
  if (!rules || typeof category !== "string") return { unit: "piece" };
  const key = Object.keys(rules).find((k) => k.trim().toLowerCase() === category.trim().toLowerCase());
  return key ? rules[key] : { unit: "piece" };
}

/**
 * A line's quantity: "1,000" and "1,00,000" are read with their digit grouping, an empty or unreadable
 * quantity counts as one, and zero or a negative number charges nothing (never a negative amount).
 */
export function parseQuantity(qty: unknown): number {
  if (typeof qty === "number") return Number.isFinite(qty) ? Math.max(0, qty) : 1;
  const text = String(qty ?? "").trim().replace(/[\s,]/g, "");
  if (text === "") return 1;
  if (!/^[-+]?(\d+\.?\d*|\.\d+)$/.test(text)) {
    const lead = text.match(/^[-+]?(\d+\.?\d*|\.\d+)/);
    // "2 pcs" is 2; anything that doesn't start with a number counts as one.
    if (!lead) return 1;
    return Math.max(0, parseFloat(lead[0]));
  }
  return Math.max(0, parseFloat(text));
}

/** What the rate is multiplied by: qty for per-piece lines, qty × area (in the rule's unit) for area lines. */
export function lineMultiplier(unit: PricingUnit, qty: unknown, size: unknown): { multiplier: number; area: number | null } {
  const q = parseQuantity(qty);
  if (!isAreaPricing(unit)) return { multiplier: q, area: null };
  const area = areaIn(size, unit);
  return { multiplier: area ? q * area : q, area };
}

export interface PricingUnitOptions {
  /** Area units offered, in the order the Size field lists them, each with the size units it covers. */
  areas: { unit: AreaPricingUnit; from: string[] }[];
  /** Size units that can't be measured as an area (e.g. "pcs"): lines in them price per piece. */
  unmeasurable: string[];
  /** Whether the layout has a Size field at all. */
  hasSizeField: boolean;
  /** Every unit the Size field(s) offer, in order (what a size can be typed in). */
  sizeUnits: string[];
  /** One pricing choice per Size-field unit, in order: its area unit, or per piece when it can't be measured. */
  choices: { sizeUnit: string; unit: PricingUnit }[];
}

/** The pricing choices a layout supports: per piece, plus one area unit per unit of its Size field(s). */
export function pricingUnitOptions(layout: { sections?: { fields?: { type?: string; name?: string; role?: string; sizeUnits?: string[]; defaultUnit?: string }[] }[] } | null | undefined): PricingUnitOptions {
  const sizeFields = (layout?.sections ?? []).flatMap((s) => s.fields ?? []).filter((f) => isSizeLayoutField(f));
  const areas: PricingUnitOptions["areas"] = [];
  const unmeasurable: string[] = [];
  const sizeUnits: string[] = [];
  for (const field of sizeFields) {
    for (const sizeUnit of unitsFor(field)) {
      if (!sizeUnits.some((u) => u.toLowerCase() === sizeUnit.toLowerCase())) sizeUnits.push(sizeUnit);
      const area = areaUnitForSizeUnit(sizeUnit);
      if (!area) {
        if (!unmeasurable.some((u) => u.toLowerCase() === sizeUnit.toLowerCase())) unmeasurable.push(sizeUnit);
        continue;
      }
      const existing = areas.find((a) => a.unit === area);
      if (!existing) areas.push({ unit: area, from: [sizeUnit] });
      else if (!existing.from.some((u) => u.toLowerCase() === sizeUnit.toLowerCase())) existing.from.push(sizeUnit);
    }
  }
  const choices = sizeUnits.map((sizeUnit) => ({ sizeUnit, unit: (areaUnitForSizeUnit(sizeUnit) ?? "piece") as PricingUnit }));
  return { areas, unmeasurable, hasSizeField: sizeFields.length > 0, sizeUnits, choices };
}

/**
 * The Size-field unit a rule is shown as: the one picked in Settings when the Size field still offers it
 * for the same unit, else the first Size-field unit measuring that area; null for plain per-piece rules or
 * an area the Size field no longer offers.
 */
export function ruleSizeUnit(rule: PricingRule, options: PricingUnitOptions): string | null {
  const picked = rule.sizeUnit ? options.choices.find((c) => c.sizeUnit.toLowerCase() === rule.sizeUnit!.toLowerCase() && c.unit === rule.unit) : undefined;
  if (picked) return picked.sizeUnit;
  if (!isAreaPricing(rule.unit)) return null;
  return options.choices.find((c) => c.unit === rule.unit)?.sizeUnit ?? null;
}

export const rateKey = (secKey: string, index: number) => `${secKey}_${index}`;

/** "1,250.50" → 1250.5; invalid → 0. */
export const parseCurrency = (str: string) => parseFloat(str.replace(/,/g, "")) || 0;

/** A rate or discount: like `parseCurrency`, but never below zero (a negative one would move money the wrong way). */
export const parseNonNegative = (value: unknown) => Math.max(0, parseCurrency(String(value ?? "")));

/** 1250.5 → "1,250.50" (en-IN grouping). */
export const formatCurrencyInput = (num: number) =>
  num.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Advance written to the form: Σ installment amounts (commas tolerated). */
export const advanceFromInstallments = (installments: Installment[]) =>
  installments.reduce((acc, curr) => acc + parseCurrency(curr.amount || "0"), 0);

/** Σ installment amounts as displayed ("Total Advance", outstanding balance). */
export const installmentsTotal = (installments: Installment[]) =>
  installments.reduce((sum, inst) => sum + (parseFloat(inst.amount) || 0), 0);

/** Installments sent to the server: only those with a positive amount. */
export const payableInstallments = (installments: Installment[]) =>
  installments.filter((inst) => parseFloat(inst.amount) > 0);

/** Package/grand-total form value as a number (tolerates "1,250"). */
export const packageAmount = (pkg: unknown) => parseFloat(((pkg || "0") as string).toString().replace(/,/g, "")) || 0;

/** Outstanding balance shown under the financial section. */
export const outstandingBalance = (pkg: unknown, installments: Installment[]) =>
  Math.max(0, packageAmount(pkg) - installmentsTotal(installments));

const findRepeatableSection = (layout: FormLayout | null | undefined, secKey: string) =>
  layout?.sections?.find((s) => `rep_${s.id}` === secKey);

const isCategoryName = (s: string) => s.toLowerCase().includes("category") || s.toLowerCase().includes("job");
const isQtyName = (s: string) => s.toLowerCase().includes("qty") || s.toLowerCase().includes("quantity");

/** Σ rate × qty (× area for per-sq-ft categories) over repeatable entries that have a category; `hasRates` when any entry counted. */
export function computeLineItemsPackage(
  repeatableData: RepeatableData,
  financialRates: FinancialRates,
  layout: FormLayout | null | undefined,
  fieldMap: FieldMap,
  rules: PricingRules = {},
  /** How each line was priced (rate key → unit), as saved with a job; wins over `rules` when given. */
  savedUnits?: Record<string, unknown>
): { hasRates: boolean; total: number } {
  let total = 0;
  let hasRates = false;

  Object.keys(repeatableData).forEach((secKey) => {
    const repSection = findRepeatableSection(layout, secKey);
    const entries = repeatableData[secKey] || [];
    entries.forEach((entry, idx) => {
      const { catFieldKey, sizeFieldKey, qtyFieldKey } = lineItemKeys(entry, repSection, fieldMap);
      if (catFieldKey && entry[catFieldKey]) {
        hasRates = true;
        const rate = parseNonNegative(financialRates[rateKey(secKey, idx)]);
        const saved = savedUnits?.[rateKey(secKey, idx)];
        const unit = savedUnits ? (isPricingUnit(saved) ? saved : "piece") : pricingRuleFor(rules, entry[catFieldKey]).unit;
        const { multiplier } = lineMultiplier(unit, qtyFieldKey ? entry[qtyFieldKey] : "", sizeFieldKey ? entry[sizeFieldKey] : "");
        total += rate * multiplier;
      }
    });
  });

  return { hasRates, total };
}

/** Form key of the discount field: a layout field named "…discount…", else any value key containing it. */
export function findDiscountKey(
  values: Record<string, unknown>,
  layout: FormLayout | null | undefined,
  fieldMap: FieldMap
): string | undefined {
  let key = Object.keys(values).find((k) => k.toLowerCase().includes("discount"));
  if (layout && layout.sections) {
    // The Discount role wins; older layouts are matched by label.
    const discF = findRoleField(layout, "discount") ?? allFields(layout).find((f) => (f.name || "").toLowerCase().includes("discount"));
    if (discF) key = fieldNameFor(fieldMap, discF.id);
  }
  return key;
}

export interface JobTotalsInput {
  values: Record<string, any>;
  installments: Installment[];
  repeatableData: RepeatableData;
  financialRates: FinancialRates;
  layout: FormLayout | null | undefined;
  fieldMap: FieldMap;
  rules?: PricingRules;
}

/**
 * Derived financial form values. Only the keys that the form should overwrite are returned:
 * `advance` when there are installments, `package` when line-item rates drive it and it changed,
 * and always `due`.
 */
export function computeJobTotals({ values, installments, repeatableData, financialRates, layout, fieldMap, rules = {} }: JobTotalsInput): {
  advance?: string;
  package?: string;
  due: string;
} {
  const out: { advance?: string; package?: string; due: string } = { due: "" };
  const current = { ...values };

  if (installments.length > 0) {
    const sum = advanceFromInstallments(installments);
    out.advance = sum > 0 ? sum.toString() : "";
    current.advance = out.advance;
  }

  const { hasRates, total: lineItemsTotal } = computeLineItemsPackage(repeatableData, financialRates, layout, fieldMap, rules);
  if (hasRates) {
    const discountKey = findDiscountKey(current, layout, fieldMap);
    const discount = discountKey ? parseNonNegative(current[discountKey]) : 0;
    const grandTotal = Math.max(0, lineItemsTotal - discount);
    if (current.package !== grandTotal.toString()) {
      out.package = grandTotal.toString();
      current.package = out.package;
    }
  }

  const total = parseCurrency(current.package || "0");
  const advance = parseCurrency(current.advance || "0");
  const outstanding = Math.max(0, total - advance);
  out.due = total > 0 || advance > 0 ? formatCurrencyInput(outstanding) : "";
  return out;
}

export interface LineItemRow {
  secKey: string;
  index: number;
  rateKey: string;
  /** The entry's category value. */
  category: unknown;
  /** " (size, Qty: n)" or "". */
  extraText: string;
  qty: string;
  /** The entry's size value, as typed. */
  size: string;
}

/** Rows of the "Rates per Job" list: every repeatable entry that has a category value. */
export function lineItemRows(
  repeatableData: RepeatableData,
  layout: FormLayout | null | undefined,
  fieldMap: FieldMap
): LineItemRow[] {
  const rows: LineItemRow[] = [];
  Object.keys(repeatableData).forEach((secKey) => {
    const repSection = findRepeatableSection(layout, secKey);
    (repeatableData[secKey] || []).forEach((entry, idx) => {
      const { catFieldKey, sizeFieldKey, qtyFieldKey } = lineItemKeys(entry, repSection, fieldMap);
      if (!catFieldKey || !entry[catFieldKey]) return;

      const sizeVal = sizeFieldKey ? entry[sizeFieldKey] : "";
      const qtyVal = qtyFieldKey ? entry[qtyFieldKey] : "";
      const extras: string[] = [];
      if (sizeVal) extras.push(sizeVal);
      if (qtyVal) extras.push(`Qty: ${qtyVal}`);
      const extraText = extras.length > 0 ? ` (${extras.join(", ")})` : "";

      rows.push({ secKey, index: idx, rateKey: rateKey(secKey, idx), category: entry[catFieldKey], extraText, qty: qtyVal, size: sizeVal });
    });
  });
  return rows;
}

/** Entry keys for category/size/qty: by the layout field's name first, then by the key itself. */
function lineItemKeys(entry: RepeatableEntry, repSection: FormSection | undefined, fieldMap: FieldMap) {
  let catFieldKey: string | undefined;
  let sizeFieldKey: string | undefined;
  let qtyFieldKey: string | undefined;

  if (repSection && repSection.fields) {
    const fieldFor = (k: string) => repSection.fields.find((field) => fieldNameFor(fieldMap, field.id) === k);
    // Field roles first (explicit or inferred for this section), then the older label matching.
    const keyOfRole = (role: "category" | "size" | "quantity") => {
      const f = findRoleField({ sections: [repSection] }, role);
      const k = f ? fieldNameFor(fieldMap, f.id) : undefined;
      return k && k in entry ? k : undefined;
    };
    catFieldKey = keyOfRole("category");
    sizeFieldKey = keyOfRole("size");
    qtyFieldKey = keyOfRole("quantity");
    if (!catFieldKey) catFieldKey = Object.keys(entry).find((k) => {
      const f = fieldFor(k);
      return f && isCategoryName(f.name);
    });
    if (!sizeFieldKey) sizeFieldKey = Object.keys(entry).find((k) => isSizeLayoutField(fieldFor(k)));
    if (!qtyFieldKey) qtyFieldKey = Object.keys(entry).find((k) => {
      const f = fieldFor(k);
      return f && isQtyName(f.name);
    });
  }

  if (!catFieldKey) catFieldKey = Object.keys(entry).find(isCategoryName);
  if (!sizeFieldKey) sizeFieldKey = Object.keys(entry).find((k) => k.toLowerCase().includes("size"));
  // A size entered before the layout's Size field was replaced still lives under the old field id.
  if (!sizeFieldKey) sizeFieldKey = Object.keys(entry).find((k) => looksLikeSize(entry[k]));
  if (!qtyFieldKey) qtyFieldKey = Object.keys(entry).find(isQtyName);

  return { catFieldKey, sizeFieldKey, qtyFieldKey };
}

/** Line total shown next to a rate input: rate × qty, or rate × area × qty for per-sq-ft lines. */
export const lineItemTotal = (rate: string | undefined, qty: string, unit: PricingUnit = "piece", size: unknown = "") =>
  parseNonNegative(rate) * lineMultiplier(unit, qty, size).multiplier;

/** Σ line totals over all repeatable entries (with or without a category), shown under the rates. */
export function sumLineItems(
  repeatableData: RepeatableData,
  financialRates: FinancialRates,
  layout: FormLayout | null | undefined,
  fieldMap: FieldMap,
  rules: PricingRules = {}
): number {
  let sum = 0;
  Object.keys(repeatableData).forEach((secKey) => {
    const repSection = findRepeatableSection(layout, secKey);
    (repeatableData[secKey] || []).forEach((entry, idx) => {
      const rate = parseNonNegative(financialRates[rateKey(secKey, idx)]);
      const { catFieldKey, sizeFieldKey, qtyFieldKey } = lineItemKeys(entry, repSection, fieldMap);
      const { unit } = pricingRuleFor(rules, catFieldKey ? entry[catFieldKey] : undefined);
      sum += rate * lineMultiplier(unit, qtyFieldKey ? entry[qtyFieldKey] : "", sizeFieldKey ? entry[sizeFieldKey] : "").multiplier;
    });
  });
  return sum;
}

/** Rate boxes the form filled itself with a category's default rate, and from which category. */
export type AutoRates = Record<string, { category: string; value: string }>;

/**
 * What the job form's rate boxes need when categories change. An empty box gets the category's default
 * rate. A box still holding a default the form filled follows its line to the new category's default
 * (or empties when that category has none). A rate someone typed, or one loaded from a saved job, is
 * never touched. `patch` maps rate keys to the new value, or null to empty the box.
 */
export function defaultRateUpdates(
  rows: { rateKey: string; category: unknown }[],
  rates: FinancialRates,
  rules: PricingRules,
  auto: AutoRates
): { patch: Record<string, string | null>; auto: AutoRates } {
  const patch: Record<string, string | null> = {};
  const next: AutoRates = {};
  for (const { rateKey, category } of rows) {
    const cat = typeof category === "string" ? category : "";
    const def = pricingRuleFor(rules, cat).defaultRate;
    const defText = def ? String(def) : undefined;
    const current = rates[rateKey];
    const filled = auto[rateKey];
    if (current === undefined) {
      if (defText) {
        patch[rateKey] = defText;
        next[rateKey] = { category: cat, value: defText };
      }
    } else if (filled && current === filled.value) {
      if (filled.category.trim().toLowerCase() === cat.trim().toLowerCase()) next[rateKey] = filled;
      else if (defText) {
        patch[rateKey] = defText;
        next[rateKey] = { category: cat, value: defText };
      } else patch[rateKey] = null;
    }
  }
  return { patch, auto: next };
}

const jsonOf = <T,>(v: unknown, fallback: T): T => {
  if (typeof v !== "string") return v && typeof v === "object" ? (v as T) : fallback;
  try {
    const parsed = JSON.parse(v);
    return parsed && typeof parsed === "object" ? (parsed as T) : fallback;
  } catch {
    return fallback;
  }
};

/**
 * The package a job's saved values add up to: Σ rate × quantity (× area, in each line's saved unit) over
 * its line items, minus the discount, never below zero, in paise. Null when no line rates drive the total
 * (the package was typed directly). The server compares this with the package a save sends.
 */
export function packageFromSavedValues(customData: Record<string, unknown>, layout: FormLayout | null | undefined, fieldMap: FieldMap): number | null {
  const repeatableData: RepeatableData = {};
  for (const [key, value] of Object.entries(customData)) {
    if (!key.startsWith("rep_")) continue;
    const entries = jsonOf<unknown>(value, []);
    if (Array.isArray(entries)) repeatableData[key] = entries.filter((e) => e && typeof e === "object") as RepeatableEntry[];
  }
  const rates = jsonOf<FinancialRates>(customData.fld_financial_rates, {});
  const units = jsonOf<Record<string, unknown>>(customData.fld_financial_units, {});
  const { hasRates, total } = computeLineItemsPackage(repeatableData, rates, layout, fieldMap, {}, units);
  if (!hasRates) return null;
  const discountKey = findDiscountKey(customData, layout, fieldMap);
  const discount = discountKey ? parseNonNegative(customData[discountKey]) : 0;
  return Math.round(Math.max(0, total - discount) * 100) / 100;
}
