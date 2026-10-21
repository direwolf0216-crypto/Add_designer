// Job form pricing: line-item rates × quantity − discount = package (grand total); installments
// sum to the advance; due = package − advance. Pure functions, mirrored 1:1 from the job form.
//
// Note: three slightly different "which entry key is the category / quantity" heuristics exist
// (package calculation, rate rows, line-item sum). They are kept separate on purpose so the
// numbers shown and saved do not change.

import { allFields, fieldNameFor } from "@/lib/forms/fieldMap";
import type { FieldMap, FormLayout, FormSection, RepeatableData, RepeatableEntry } from "@/lib/forms/types";

export interface Installment {
  amount: string;
  date: string;
  paymentMode: string;
  /** Existing INCOME transaction this installment edits. */
  transactionId?: string;
}

/** Financial rates per repeatable entry, keyed `rep_<sectionId>_<index>`. */
export type FinancialRates = Record<string, string>;

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

/** Σ rate × qty over repeatable entries that have a category; `hasRates` when any entry counted. */
export function computeLineItemsPackage(
  repeatableData: RepeatableData,
  financialRates: FinancialRates,
  layout: FormLayout | null | undefined,
  fieldMap: FieldMap
): { hasRates: boolean; total: number } {
  let total = 0;
  let hasRates = false;

  Object.keys(repeatableData).forEach((secKey) => {
    const repSection = findRepeatableSection(layout, secKey);
    const entries = repeatableData[secKey] || [];
    entries.forEach((entry, idx) => {
      let catFieldKey = Object.keys(entry).find(isCategoryName);
      let qtyFieldKey = Object.keys(entry).find(isQtyName);

      if (repSection && repSection.fields) {
        const catF = repSection.fields.find((f) => isCategoryName(f.name));
        if (catF) catFieldKey = fieldNameFor(fieldMap, catF.id);
        const qtyF = repSection.fields.find((f) => isQtyName(f.name));
        if (qtyF) qtyFieldKey = fieldNameFor(fieldMap, qtyF.id);
      }

      if (catFieldKey && entry[catFieldKey]) {
        hasRates = true;
        const rate = parseCurrency(financialRates[rateKey(secKey, idx)] || "0");
        let qty = 1;
        if (qtyFieldKey && entry[qtyFieldKey]) qty = parseFloat(entry[qtyFieldKey]) || 1;
        total += rate * qty;
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
}

/**
 * Derived financial form values. Only the keys that the form should overwrite are returned:
 * `advance` when there are installments, `package` when line-item rates drive it and it changed,
 * and always `due`.
 */
export function computeJobTotals({ values, installments, repeatableData, financialRates, layout, fieldMap }: JobTotalsInput): {
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

  const { hasRates, total: lineItemsTotal } = computeLineItemsPackage(repeatableData, financialRates, layout, fieldMap);
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

      rows.push({ secKey, index: idx, rateKey: rateKey(secKey, idx), category: entry[catFieldKey], extraText, qty: qtyVal });
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
    sizeFieldKey = Object.keys(entry).find((k) => {
      const f = fieldFor(k);
      return f && f.name.toLowerCase().includes("size");
    });
    qtyFieldKey = Object.keys(entry).find((k) => {
      const f = fieldFor(k);
      return f && isQtyName(f.name);
    });
  }

  if (!catFieldKey) catFieldKey = Object.keys(entry).find(isCategoryName);
  if (!sizeFieldKey) sizeFieldKey = Object.keys(entry).find((k) => k.toLowerCase().includes("size"));
  if (!qtyFieldKey) qtyFieldKey = Object.keys(entry).find(isQtyName);

  return { catFieldKey, sizeFieldKey, qtyFieldKey };
}

/** Line total shown next to a rate input. */
export const lineItemTotal = (rate: string | undefined, qty: string) => (parseFloat(rate as string) || 0) * (parseFloat(qty) || 1);

/** Σ rate × qty over all repeatable entries (with or without a category), shown under the rates. */
export function sumLineItems(
  repeatableData: RepeatableData,
  financialRates: FinancialRates,
  layout: FormLayout | null | undefined,
  fieldMap: FieldMap
): number {
  let sum = 0;
  Object.keys(repeatableData).forEach((secKey) => {
    const repSection = findRepeatableSection(layout, secKey);
    (repeatableData[secKey] || []).forEach((entry, idx) => {
      const rate = parseFloat(financialRates[rateKey(secKey, idx)]) || 0;
      const qtyFieldKey = Object.keys(entry).find((k) => {
        if (repSection && repSection.fields) {
          const f = repSection.fields.find((field) => fieldNameFor(fieldMap, field.id) === k);
          if (f && isQtyName(f.name)) return true;
        }
        return isQtyName(k);
      });
      const qty = qtyFieldKey ? parseFloat(entry[qtyFieldKey]) || 1 : 1;
      sum += rate * qty;
    });
  });
  return sum;
}
