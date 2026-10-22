// Job form ⇄ data mapping: API job → form state (edit), layout → defaults (create), and form state
// → the FormData sent to saveJobAction. Pure: no React, no network.

import { toLocalISODate } from "@/lib/dates";
import { lineItemRows, pricingRuleFor, type PricingRules, type PricingUnit } from "@/lib/jobs/pricing";
import { categoryFromCustomData } from "@/lib/jobs/category";
import { allFields, fieldNameFor } from "@/lib/forms/fieldMap";
import { collapseFileArray, isUploadableFile } from "@/lib/forms/files";
import { defaultsToFirstOption, firstOptionDefault } from "@/lib/forms/options";
import type { FieldMap, FormField, FormLayout, FormSection, RepeatableData, RepeatableEntry, VisibilityRule } from "@/lib/forms/types";
import { payableInstallments, rateKey, type FinancialRates, type Installment } from "./pricing";
import { resolveDefaultValue, type DefaultContext } from "@/lib/forms/defaults";
import { validateFieldValue } from "@/lib/forms/validation";

/** Visibility predicate bound to the form's current values. */
export type IsVisible = (rule: VisibilityRule | null | undefined) => boolean;

/** API job shape as far as the form reads it. */
export interface JobRecord {
  id: string;
  title?: string;
  phone?: string;
  email?: string;
  date?: string | Date;
  time?: string;
  category?: string;
  location?: string;
  status?: string;
  customData?: unknown;
  client?: { name?: string; phone?: string; email?: string } | null;
  order?: { package?: number | string; advance?: number | string; due?: number | string; installments?: Installment[] } | null;
  transactions?: { id: string; amount: number; date: string | Date; paymentMode?: string | null; type?: string; category?: string; deletedAt?: unknown }[];
  [key: string]: unknown;
}

export const newInstallment = (today: string = toLocalISODate()): Installment => ({ amount: "", date: today, paymentMode: "Cash" });

/** customData arrives as a JSON string or an object; anything else is treated as empty. */
export function parseCustomData(raw: unknown): Record<string, any> {
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  if (raw && typeof raw === "object") return raw as Record<string, any>;
  return {};
}

export interface JobFormState {
  values: Record<string, any>;
  repeatableData: RepeatableData;
  /** `undefined` when the stored rates are unparseable: the form keeps its current rates. */
  financialRates: FinancialRates | undefined;
  installments: Installment[];
  isMultiInstallment: boolean;
}

/** Edit mode: the form state for an existing job. */
export function jobToFormState(job: JobRecord, today: string = toLocalISODate()): JobFormState {
  const b = job;
  // Copy so pulling out the rep_* keys never mutates the SWR-cached job.
  const parsedCustomData: Record<string, any> = { ...parseCustomData(b.customData) };

  const repeatableData: RepeatableData = {};
  Object.keys(parsedCustomData).forEach((key) => {
    if (key.startsWith("rep_")) {
      let val = parsedCustomData[key];
      if (typeof val === "string") {
        try {
          val = JSON.parse(val);
        } catch {}
      }
      repeatableData[key] = Array.isArray(val) ? val : [];
      delete parsedCustomData[key];
    }
  });

  let financialRates: FinancialRates | undefined;
  if (parsedCustomData.fld_financial_rates) {
    try {
      financialRates = JSON.parse(parsedCustomData.fld_financial_rates);
    } catch {}
  } else {
    financialRates = {};
  }

  const values: Record<string, any> = {
    id: b.id,
    title: b.client?.name || b.title || parsedCustomData.fld_b_client || "",
    phone: b.client?.phone || b.phone || parsedCustomData.fld_b_phone || "",
    email: b.client?.email || b.email || parsedCustomData.fld_b_email || "",
    date: b.date
      ? typeof b.date === "string"
        ? b.date.split("T")[0]
        : new Date(b.date).toISOString().split("T")[0]
      : parsedCustomData.fld_b_date || "",
    time: parsedCustomData.fld_b_time || b.time || "",
    category: b.category || categoryFromCustomData(parsedCustomData),
    location: b.location || parsedCustomData.fld_b_location || "",
    status: b.status || parsedCustomData.fld_b_status || "",
    package: b.order?.package ? b.order.package.toString() : parsedCustomData.fld_b_package || "",
    advance: b.order?.advance ? b.order.advance.toString() : parsedCustomData.fld_b_advance || "",
    due: b.order?.due ? b.order.due.toString() : "",
    ...parsedCustomData,
  };

  // Only the job's own installment payments; other linked transactions (expenses, due collections) aren't installments.
  const validTransactions = (b.transactions || []).filter((tx) => !tx.deletedAt && tx.type === "INCOME" && tx.category === "JOB");
  let installments: Installment[];
  let isMultiInstallment: boolean;
  if (validTransactions.length > 0) {
    isMultiInstallment = validTransactions.length > 1;
    installments = validTransactions
      .sort((x, y) => new Date(x.date).getTime() - new Date(y.date).getTime())
      .map((tx) => ({
        amount: tx.amount.toString(),
        date: toLocalISODate(new Date(tx.date)),
        paymentMode: tx.paymentMode || "Cash",
        transactionId: tx.id,
      }));
  } else if (b.order?.installments && Array.isArray(b.order.installments) && b.order.installments.length > 0) {
    isMultiInstallment = b.order.installments.length > 1;
    installments = b.order.installments;
  } else {
    isMultiInstallment = false;
    installments = [
      {
        amount: b.order?.advance ? b.order.advance.toString() : values.advance || "",
        date: today,
        paymentMode: values.paymentMode || "Cash",
      },
    ];
  }

  return { values, repeatableData, financialRates, installments, isMultiInstallment };
}

/** A new entry of a repeatable section: pick-lists start at their first option, others at their default. */
export function newRepeatableEntry(section: FormSection, fieldMap: FieldMap, ctx: DefaultContext = { today: toLocalISODate() }): RepeatableEntry {
  const entry: RepeatableEntry = {};
  section.fields.forEach((f) => {
    const fname = fieldNameFor(fieldMap, f.id);
    const preset = resolveDefaultValue(f, ctx);
    if (preset !== undefined) entry[fname] = preset;
    else if (defaultsToFirstOption(f)) entry[fname] = firstOptionDefault(f);
  });
  return entry;
}

/** Create mode: default values and one starter entry per repeatable section. */
export function layoutDefaults(
  layout: FormLayout | null | undefined,
  fieldMap: FieldMap,
  defaultDate: string,
  ctx: Partial<DefaultContext> = {}
): { values: Record<string, any>; repeatableData: RepeatableData } {
  const defaultCtx: DefaultContext = { today: defaultDate, ...ctx };
  const values: Record<string, any> = {
    title: "", category: "", date: defaultDate, time: "10:00 AM",
    location: "", phone: "", email: "", package: "", advance: "", due: "", status: "Confirmed",
  };
  const repeatableData: RepeatableData = {};
  if (!layout?.sections) return { values, repeatableData };

  // The first STATUS_PICKER feeds the job's `status` column.
  const statusFieldId = allFields(layout).find((f) => f.type === "STATUS_PICKER")?.id ?? "fld_b_status";

  layout.sections.forEach((sec) => {
    if (sec.isRepeatable) {
      repeatableData[`rep_${sec.id}`] = [newRepeatableEntry(sec, fieldMap, defaultCtx)];
      // The job's status picker may sit inside the repeatable section; its first option is still the default status.
      const statusF = sec.fields.find((f) => f.id === statusFieldId && f.type === "STATUS_PICKER");
      if (statusF?.statusOptions?.length) values.status = statusF.statusOptions[0].label;
      return; // Repeatable fields are not flattened into the form values.
    }
    sec.fields.forEach((f) => {
      const fname = f.id === statusFieldId && f.type === "STATUS_PICKER" ? "status" : fieldNameFor(fieldMap, f.id);
      if (f.type === "STATUS_PICKER" && f.statusOptions && f.statusOptions.length > 0) {
        values[fname] = f.statusOptions[0].label;
      } else if (defaultsToFirstOption(f)) {
        values[fname] = firstOptionDefault(f);
      }
      const preset = resolveDefaultValue(f, defaultCtx);
      if (preset !== undefined) values[fname] = preset;
    });
  });

  return { values, repeatableData };
}

/**
 * Display order of the financial section's fields: package/total, discount, advance, then the rest
 * (stable). With `paymentAfterAdvance`, payment fields come right after advance.
 */
export function sortFinancialFields<F extends FormField>(fields: F[], fieldMap: FieldMap, paymentAfterAdvance: boolean): F[] {
  const order = (field: F) => {
    if (field.role === "total") return 0;
    if (field.role === "discount") return 1;
    if (field.role === "advance") return 2;
    const nameStr = (fieldNameFor(fieldMap, field.id) + " " + (field.name || "")).toLowerCase();
    if (nameStr.includes("package") || nameStr.includes("total")) return 0;
    if (nameStr.includes("discount")) return 1;
    if (nameStr.includes("advance")) return 2;
    if (paymentAfterAdvance && nameStr.includes("payment")) return 3;
    return 99;
  };
  return [...fields].sort((a, b) => order(a) - order(b));
}

/** Entries of one repeatable section without the entry at `index`. */
export function removeRepeatableEntry(data: RepeatableData, secKey: string, index: number): RepeatableData {
  const arr = [...(data[secKey] || [])];
  arr.splice(index, 1);
  return { ...data, [secKey]: arr };
}

/**
 * Rates are keyed by entry position: after removing entry `index` of `count`, shift later entries'
 * rates down so each rate stays with its item.
 */
export function shiftRatesAfterRemoval(rates: FinancialRates, secKey: string, index: number, count: number): FinancialRates {
  const next = { ...rates };
  for (let i = index; i < count - 1; i++) {
    const later = rates[rateKey(secKey, i + 1)];
    if (later === undefined) delete next[rateKey(secKey, i)];
    else next[rateKey(secKey, i)] = later;
  }
  delete next[rateKey(secKey, count - 1)];
  return next;
}

/** Repeatable sections that have no entries (each needs at least one). */
export function emptyRepeatableSections(layout: FormLayout | null | undefined, repeatableData: RepeatableData): FormSection[] {
  if (!layout?.sections) return [];
  return layout.sections.filter((s) => s.isRepeatable && (repeatableData[`rep_${s.id}`] || []).length === 0);
}

const isEmptyValue = (v: unknown) => !v || (Array.isArray(v) && v.length === 0);

/** Visible mandatory fields (outside repeatable sections) without a value, in layout order. */
export function missingMandatoryFields(
  layout: FormLayout | null | undefined,
  data: Record<string, unknown>,
  isVisible: IsVisible,
  fieldMap: FieldMap
): { fieldName: string; message: string }[] {
  const missing: { fieldName: string; message: string }[] = [];
  if (!layout?.sections) return missing;
  layout.sections.forEach((section) => {
    if (section.isRepeatable || !isVisible(section.visibilityRule)) return;
    section.fields.forEach((field) => {
      if (!isVisible(field.visibilityRule)) return;
      const fieldName = fieldNameFor(fieldMap, field.id);
      if (isRequiredNow(field, isVisible) && isEmptyValue(data[fieldName])) {
        missing.push({ fieldName, message: `${field.name} is required` });
      }
    });
  });
  return missing;
}

/** Required outright, or required while its "required when" rule holds. */
export function isRequiredNow(field: Pick<FormField, "mandatory" | "mandatoryRule">, isVisible: IsVisible): boolean {
  return !!field.mandatory || (!!field.mandatoryRule && isVisible(field.mandatoryRule));
}

/** Validation errors (bounds, length, format) of the visible flat fields. */
export function fieldValidationErrors(
  layout: FormLayout | null | undefined,
  data: Record<string, unknown>,
  isVisible: IsVisible,
  fieldMap: FieldMap
): { fieldName: string; message: string }[] {
  const errors: { fieldName: string; message: string }[] = [];
  layout?.sections?.forEach((section) => {
    if (section.isRepeatable || !isVisible(section.visibilityRule)) return;
    section.fields.forEach((field) => {
      if (!isVisible(field.visibilityRule)) return;
      const fieldName = fieldNameFor(fieldMap, field.id);
      const message = validateFieldValue(field, data[fieldName]);
      if (message) errors.push({ fieldName, message });
    });
  });
  return errors;
}

/** Values without the fields hidden by visibility rules (hidden fields are not submitted). */
export function withoutHiddenFields<T extends Record<string, unknown>>(
  data: T,
  layout: FormLayout | null | undefined,
  isVisible: IsVisible,
  fieldMap: FieldMap
): T {
  const out = { ...data };
  layout?.sections?.forEach((section) => {
    const secVisible = isVisible(section.visibilityRule);
    section.fields.forEach((field) => {
      if (!(secVisible && isVisible(field.visibilityRule))) delete out[fieldNameFor(fieldMap, field.id)];
    });
  });
  return out;
}

/**
 * Normalises file fields before upload: `[file]` → `file`; other objects are JSON-encoded.
 * Returns the picked files that still need uploading, by key.
 */
export function prepareFileValues(data: Record<string, any>): { data: Record<string, any>; uploads: { key: string; file: File | Blob }[] } {
  const out = { ...data };
  const uploads: { key: string; file: File | Blob }[] = [];
  for (const [key, value] of Object.entries(out)) {
    const valToProcess = collapseFileArray(value);
    if (valToProcess !== value) out[key] = valToProcess;

    if (isUploadableFile(valToProcess)) {
      uploads.push({ key, file: valToProcess });
    } else if (valToProcess && typeof valToProcess === "object" && !Array.isArray(valToProcess)) {
      out[key] = JSON.stringify(valToProcess);
    }
  }
  return { data: out, uploads };
}

export interface JobPayloadInput {
  data: Record<string, unknown>;
  repeatableData: RepeatableData;
  financialRates: FinancialRates;
  installments: Installment[];
  layout: FormLayout | null | undefined;
  fieldMap: FieldMap;
  /** Pricing rules in force now; each line's unit is stored with the job so later rule changes don't reprice it. */
  rules?: PricingRules;
}

/** The FormData sent to saveJobAction (job fields, repeatable entries, rates, record date, installments). */
export function buildJobFormData({ data, repeatableData, financialRates, installments, layout, fieldMap, rules = {} }: JobPayloadInput): FormData {
  const formData = new FormData();
  Object.entries(data).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (typeof value === "object" && !Array.isArray(value)) formData.append(key, JSON.stringify(value));
    else if (Array.isArray(value)) formData.append(key, value.join(", "));
    else formData.append(key, value as string);
  });

  Object.entries(repeatableData).forEach(([key, value]) => {
    formData.append(key, JSON.stringify(value));
  });

  formData.append("fld_financial_rates", JSON.stringify(financialRates));
  const units: Record<string, PricingUnit> = {};
  for (const row of lineItemRows(repeatableData, layout, fieldMap)) units[row.rateKey] = pricingRuleFor(rules, row.category).unit;
  formData.append("fld_financial_units", JSON.stringify(units));

  const recordDateField = allFields(layout).find((f) => f.isRecordDate);
  if (recordDateField) {
    const recordDateValue = data[fieldNameFor(fieldMap, recordDateField.id)];
    if (recordDateValue) formData.append("recordDate", recordDateValue as string);
  }

  // Installment payments are created/updated/removed server-side in the same transaction as the job.
  formData.set("installments", JSON.stringify(payableInstallments(installments)));
  return formData;
}
