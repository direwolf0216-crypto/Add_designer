// Job form pricing: line-item rates × quantity − discount = package (grand total); installments
// sum to the advance; due = package − advance. Pure functions, mirrored 1:1 from the job form.
//
// Note: three slightly different "which entry key is the category / quantity" heuristics exist
// (package calculation, rate rows, line-item sum). They are kept separate on purpose so the
// numbers shown and saved do not change.

import { allFields, fieldNameFor } from "@/lib/forms/fieldMap";
import type { FieldMap, FormLayout, FormSection, RepeatableData, RepeatableEntry } from "@/lib/forms/types";
import { isSizeLayoutField, looksLikeSize } from "./size";

export interface Installment {
  amount: string;
  date: string;
  paymentMode: string;
  /** Existing INCOME transaction this installment edits. */
  transactionId?: string;
}

/** Financial rates per repeatable entry, keyed `rep_<sectionId>_<index>`. */
export type FinancialRates = Record<string, string>;

/** How a category is priced: per piece (rate × qty) or per square foot (rate × area × qty). Keyed by category name. */
export type PricingUnit = "piece" | "sqft";
export type PricingRule = { unit: PricingUnit; defaultRate?: number };
export type PricingRules = Record<string, PricingRule>;

const SQFT_PER: Record<string, number> = { ft: 1, feet: 1, foot: 1, "'": 1, in: 1 / 144, inch: 1 / 144, inches: 1 / 144, '"': 1 / 144, cm: 1 / 929.0304, mm: 1 / 92903.04, m: 10.7639, mtr: 10.7639, meter: 10.7639, metre: 10.7639, yd: 9, yard: 9, yards: 9 };

/**
 * Area in square feet from a size like "10 x 10", "4*6 ft", "3.5 x 2 in" or "120 x 60 cm". Feet when no unit
 * is given; a unit after either number applies to both. Null when the size isn't two numbers.
 */
export function parseAreaSqFt(size: unknown): number | null {
  if (size === null || size === undefined) return null;
  const text = String(size).trim().toLowerCase().replace(/×/g, "x");
  const m = text.match(/^(\d+(?:\.\d+)?)\s*([a-z'"]+)?\s*[x*]\s*(\d+(?:\.\d+)?)\s*([a-z'"]+)?\s*(?:sq\.?\s*ft)?$/);
  if (!m) return null;
  const unit = m[4] || m[2] || "ft";
  // A unit the shop defined itself (e.g. "pcs") has no square-foot conversion: the line prices per piece.
  const factor = SQFT_PER[unit];
  if (!factor) return null;
  const area = parseFloat(m[1]) * parseFloat(m[3]) * factor;
  return Number.isFinite(area) && area > 0 ? Math.round(area * 1000) / 1000 : null;
}

/** The pricing rule for a category (case-insensitive), per piece when none is set. */
export function pricingRuleFor(rules: PricingRules | null | undefined, category: unknown): PricingRule {
  if (!rules || typeof category !== "string") return { unit: "piece" };
  const key = Object.keys(rules).find((k) => k.trim().toLowerCase() === category.trim().toLowerCase());
  return key ? rules[key] : { unit: "piece" };
}

/** What the rate is multiplied by: qty for per-piece lines, qty × area (sq ft) for per-square-foot lines. */
export function lineMultiplier(unit: PricingUnit, qty: unknown, size: unknown): { multiplier: number; area: number | null } {
  const q = parseFloat(String(qty ?? "")) || 1;
  if (unit !== "sqft") return { multiplier: q, area: null };
  const area = parseAreaSqFt(size);
  return { multiplier: area ? q * area : q, area };
}

export const rateKey = (secKey: string, index: number) => `${secKey}_${index}`;

/** "1,250.50" → 1250.5; invalid → 0. */
export const parseCurrency = (str: string) => parseFloat(str.replace(/,/g, "")) || 0;

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
  rules: PricingRules = {}
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
        const rate = parseCurrency(financialRates[rateKey(secKey, idx)] || "0");
        const { unit } = pricingRuleFor(rules, entry[catFieldKey]);
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
    const discF = allFields(layout).find((f) => (f.name || "").toLowerCase().includes("discount"));
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
    const discount = discountKey ? parseCurrency(current[discountKey] || "0") : 0;
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
    catFieldKey = Object.keys(entry).find((k) => {
      const f = fieldFor(k);
      return f && isCategoryName(f.name);
    });
    sizeFieldKey = Object.keys(entry).find((k) => isSizeLayoutField(fieldFor(k)));
    qtyFieldKey = Object.keys(entry).find((k) => {
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
  (parseFloat(rate as string) || 0) * lineMultiplier(unit, qty, size).multiplier;

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
      const rate = parseFloat(financialRates[rateKey(secKey, idx)]) || 0;
      const { catFieldKey, sizeFieldKey, qtyFieldKey } = lineItemKeys(entry, repSection, fieldMap);
      const { unit } = pricingRuleFor(rules, catFieldKey ? entry[catFieldKey] : undefined);
      sum += rate * lineMultiplier(unit, qtyFieldKey ? entry[qtyFieldKey] : "", sizeFieldKey ? entry[sizeFieldKey] : "").multiplier;
    });
  });
  return sum;
}
