// Splitting one job form into several jobs (one per Job Details entry). Isomorphic, pure.
import type { FieldMap, FormLayout, FormSection, RepeatableData, RepeatableEntry } from "@/lib/forms/types";
import { fieldNameFor } from "@/lib/forms/fieldMap";
import { computeLineItemsPackage, parseCurrency, rateKey, type FinancialRates, type Installment, type PricingRules } from "./pricing";
import { findRoleField } from "@/lib/forms/roles";
import { validateFieldValue } from "@/lib/forms/validation";

/** The repeatable "Job Details" section, whose entries become separate jobs. */
export function jobDetailsSection(layout: FormLayout | null | undefined): FormSection | undefined {
  const byTitle = layout?.sections?.find((s) => s.isRepeatable && /job (details|information)/i.test(s.title || ""));
  if (byTitle) return byTitle;
  // Any name works once the section holds the field with the Job category role.
  const categoryId = findRoleField(layout, "category")?.id;
  return categoryId ? layout?.sections?.find((s) => s.isRepeatable && s.fields.some((f) => f.id === categoryId)) : undefined;
}

/** Fields of a repeatable section that appear once per job (dates, status) rather than per item. */
export const globalFieldsOf = (section: FormSection) => section.fields.filter((f) => f.isRepeatableField === false);

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Split `total` across `weights` proportionally, in paise, with any rounding remainder on the last share. */
export function splitProportionally(total: number, weights: number[]): number[] {
  const n = weights.length;
  if (n === 0) return [];
  const sum = weights.reduce((a, b) => a + b, 0);
  const paise = Math.round(total * 100);
  if (sum <= 0) return weights.map((_, i) => (i === 0 ? total : 0));
  const shares = weights.map((w) => Math.floor((paise * w) / sum));
  const used = shares.reduce((a, b) => a + b, 0);
  shares[n - 1] += paise - used;
  return shares.map((s) => s / 100);
}

export interface JobSplit {
  /** Index of the entry in the Job Details section. */
  index: number;
  /** The entry's per-item values only (global fields lifted out). */
  entry: RepeatableEntry;
  /** Global field values for this job, keyed by form name (date, status, due-date field id …). */
  globals: Record<string, unknown>;
  /** Rates for this job's single line, keyed for index 0. */
  financialRates: FinancialRates;
  /** This job's total before discount (its line total). */
  lineTotal: number;
  /** This job's package after its discount share. */
  packageAmount: number;
  /** This job's share of each installment (same dates / modes, amounts split). */
  installments: Installment[];
}

/**
 * One payload per Job Details entry. Totals: each job gets its own line total; the discount and every
 * installment are shared out in proportion to those totals (all to the first job when nothing is priced).
 */
export function splitIntoJobs(args: {
  layout: FormLayout | null | undefined;
  fieldMap: FieldMap;
  repeatableData: RepeatableData;
  financialRates: FinancialRates;
  installments: Installment[];
  discount: number;
  /** The form's package when no line rates drive it (goes to the first job). */
  fallbackPackage: number;
  rules?: PricingRules;
}): JobSplit[] {
  const { layout, fieldMap, repeatableData, financialRates, installments, discount, fallbackPackage, rules = {} } = args;
  const section = jobDetailsSection(layout);
  if (!section) return [];
  const secKey = `rep_${section.id}`;
  const entries = repeatableData[secKey] ?? [];
  const globalNames = new Set(globalFieldsOf(section).map((f) => fieldNameFor(fieldMap, f.id)));

  const splits = entries.map((raw, index) => {
    const entry: RepeatableEntry = {};
    const globals: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(raw ?? {})) (globalNames.has(k) ? globals : entry)[k] = v;
    const rates: FinancialRates = {};
    const rate = financialRates[rateKey(secKey, index)];
    if (rate !== undefined) rates[rateKey(secKey, 0)] = rate;
    const { hasRates, total } = computeLineItemsPackage({ [secKey]: [entry] }, rates, layout, fieldMap, rules);
    return { index, entry, globals, financialRates: rates, lineTotal: hasRates ? round2(total) : 0 };
  });

  const anyPriced = splits.some((s) => s.lineTotal > 0);
  const weights = anyPriced ? splits.map((s) => s.lineTotal) : splits.map((_, i) => (i === 0 ? 1 : 0));
  const discountShares = splitProportionally(discount, weights);
  const installmentShares = installments.map((inst) => splitProportionally(parseCurrency(inst.amount || "0"), weights));

  return splits.map((s, i) => {
    const base = anyPriced ? s.lineTotal : i === 0 ? fallbackPackage : 0;
    return {
      ...s,
      packageAmount: round2(Math.max(0, base - discountShares[i])),
      installments: installments
        .map((inst, k) => ({ ...inst, transactionId: undefined, amount: installmentShares[k][i] > 0 ? String(installmentShares[k][i]) : "" }))
        .filter((inst) => parseCurrency(inst.amount || "0") > 0),
    };
  });
}

/**
 * The first job's global fields (dates, status) are also the flat form values; when the entry has not
 * set one itself, take it from the form so validation and splitting see the same value the user sees.
 */
export function withFirstEntryDefaults(layout: FormLayout | null | undefined, fieldMap: FieldMap, repeatableData: RepeatableData, values: Record<string, unknown>): RepeatableData {
  const section = jobDetailsSection(layout);
  if (!section) return repeatableData;
  const secKey = `rep_${section.id}`;
  const entries = repeatableData[secKey] ?? [];
  if (!entries.length) return repeatableData;
  const first: RepeatableEntry = { ...(entries[0] ?? {}) };
  for (const f of globalFieldsOf(section)) {
    const name = fieldNameFor(fieldMap, f.id);
    if ((first[name] === undefined || first[name] === "") && values[name] !== undefined && values[name] !== "") first[name] = values[name];
  }
  return { ...repeatableData, [secKey]: [first, ...entries.slice(1)] };
}

/** Mandatory fields missing in any Job Details entry (globals included), for validation. */
export function missingEntryFields(
  layout: FormLayout | null | undefined,
  fieldMap: FieldMap,
  repeatableData: RepeatableData,
  /** Visibility of a rule; for item fields the entry is passed so rules can depend on the entry's own values. */
  isVisible: (rule: FormSection["visibilityRule"], entry?: RepeatableEntry) => boolean
): { index: number; fieldName: string; message: string }[] {
  const section = jobDetailsSection(layout);
  if (!section || !isVisible(section.visibilityRule)) return [];
  const entries = repeatableData[`rep_${section.id}`] ?? [];
  const out: { index: number; fieldName: string; message: string }[] = [];
  entries.forEach((entry, index) => {
    for (const f of section.fields) {
      const required = !!f.mandatory || (!!f.mandatoryRule && isVisible(f.mandatoryRule, entry));
      if (!required || f.type === "STATUS_PICKER" || !isVisible(f.visibilityRule, entry)) continue;
      const name = fieldNameFor(fieldMap, f.id);
      const v = entry?.[name];
      if (!v || (Array.isArray(v) && v.length === 0)) out.push({ index, fieldName: name, message: `${f.name} is required` });
    }
  });
  return out;
}

/** Validation errors (bounds, length, format) inside each Job Details entry. */
export function entryValidationErrors(
  layout: FormLayout | null | undefined,
  fieldMap: FieldMap,
  repeatableData: RepeatableData,
  isVisible: (rule: FormSection["visibilityRule"], entry?: RepeatableEntry) => boolean = () => true
): { index: number; fieldName: string; message: string }[] {
  const section = jobDetailsSection(layout);
  if (!section) return [];
  const entries = repeatableData[`rep_${section.id}`] ?? [];
  const out: { index: number; fieldName: string; message: string }[] = [];
  entries.forEach((entry, index) => {
    for (const f of section.fields) {
      if (!isVisible(f.visibilityRule, entry)) continue;
      const name = fieldNameFor(fieldMap, f.id);
      const message = validateFieldValue(f, entry?.[name]);
      if (message) out.push({ index, fieldName: name, message });
    }
  });
  return out;
}
