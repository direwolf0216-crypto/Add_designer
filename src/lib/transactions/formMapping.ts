// Transaction form ⇄ API mapping: record → form state, layout → defaults, validation, and the
// request (single, bulk create, bulk/group edit) the form sends. Pure: no React, no network.

import { toLocalISODate } from "@/lib/dates";
import { allFields, fieldNameFor } from "@/lib/forms/fieldMap";
import { splitMultiValue } from "@/lib/forms/options";
import type { FieldMap, FormLayout } from "@/lib/forms/types";
import { resolveDefaultValue, type DefaultContext } from "@/lib/forms/defaults";
import { validateFieldValue } from "@/lib/forms/validation";
import { isVisibleIn } from "@/lib/forms/visibility";

/** Flat form state: mapped standard keys, custom field ids and `amount_<category>` split amounts. */
export type TransactionFormValues = Record<string, any>;

export interface TransactionRecord {
  id: string;
  amount: number;
  type: string;
  date: string | Date;
  category: string;
  paymentMode?: string | null;
  description?: string | null;
  status?: string;
  customData?: Record<string, unknown> | null;
  /** Grouped (bulk) transactions: one amount per category. */
  items?: { category: string; amount: number }[];
}

/** Group (bulk) transactions have ids prefixed `grp_`. */
export const isGroupId = (id: unknown) => typeof id === "string" && id.startsWith("grp_");

/** Categories selected in the form ("a, b" or an array). More than one means per-category amounts. */
export const selectedCategories = (category: unknown) => splitMultiValue(category);

/** Edit mode: form state for an existing transaction (or group). */
export function transactionToForm(tx: TransactionRecord): TransactionFormValues {
  const form: TransactionFormValues = {
    amount: String(tx.amount),
    type: tx.type,
    date: new Date(tx.date).toISOString(),
    category: tx.category,
    paymentMode: tx.paymentMode,
    description: tx.description || "",
    status: tx.status,
    ...(tx.customData || {}),
  };
  if (tx.items && Array.isArray(tx.items)) {
    tx.items.forEach((item) => {
      form[`amount_${item.category}`] = String(item.amount);
    });
  }
  return form;
}

/**
 * Create mode: pick-lists default to their first option (category stays empty), status pickers to
 * their first status, everything else to "". `preset` (from the URL or the opener) wins for type/category.
 */
export function transactionLayoutDefaults(
  layout: FormLayout,
  fieldMap: FieldMap,
  preset: { type?: string | null; category?: string | null; userId?: string | null },
  now: Date = new Date()
): TransactionFormValues {
  const form: TransactionFormValues = { type: "INCOME", status: "SETTLED", date: now.toISOString() };
  layout.sections.forEach((sec) => {
    sec.fields.forEach((f) => {
      const fname = fieldNameFor(fieldMap, f.id);
      if ((f.type === "PICK_LIST" || f.type === "MULTI_PICKLIST") && f.options && f.options.length > 0) {
        form[fname] = fname !== "category" ? f.options[0] : "";
      } else if (f.type === "STATUS_PICKER" && f.statusOptions && f.statusOptions.length > 0) {
        form[fname] = f.statusOptions[0].label;
      } else if (!form[fname]) {
        form[fname] = "";
      }
    });
  });
  // Admin-set defaults (a literal, or @today / @now / @me) win over the first option.
  const ctx: DefaultContext = { today: toLocalISODate(now), now, userId: preset.userId ?? null };
  layout.sections.forEach((sec) =>
    sec.fields.forEach((f) => {
      const v = resolveDefaultValue(f, ctx);
      if (v !== undefined) form[fieldNameFor(fieldMap, f.id)] = v as string;
    })
  );
  if (preset.type) form.type = preset.type;
  if (preset.category) form.category = preset.category;
  return form;
}

/** Field errors keyed like the form state; empty when valid. */
export function validateTransactionForm(form: TransactionFormValues, layout: FormLayout | null | undefined, fieldMap: FieldMap): Record<string, string> {
  const errs: Record<string, string> = {};
  layout?.sections?.forEach((sec) => {
    if (!isVisibleIn(sec.visibilityRule, form, fieldMap)) return;
    sec.fields.forEach((f) => {
      if (!isVisibleIn(f.visibilityRule, form, fieldMap)) return;
      const fname = fieldNameFor(fieldMap, f.id);
      const val = form[fname];
      const required = !!f.mandatory || (!!f.mandatoryRule && isVisibleIn(f.mandatoryRule, form, fieldMap));
      if (required && (val === undefined || val === null || val === "")) {
        errs[fname] = `${f.name} is required.`;
        return;
      }
      const invalid = validateFieldValue(f, val);
      if (invalid) errs[fname] = invalid;
    });
  });

  const categories = selectedCategories(form.category);
  if (categories.length > 1) {
    let allValid = true;
    categories.forEach((cat) => {
      const catAmount = parseFloat(form[`amount_${cat}`] || "0");
      if (isNaN(catAmount) || catAmount <= 0) {
        errs[`amount_${cat}`] = "Required";
        allValid = false;
      }
    });
    if (!allValid) errs.category = "Enter valid amounts for all selected categories.";
    delete errs.amount;
  } else {
    const parsedAmount = parseFloat(form.amount || "0");
    if (form.amount !== undefined && (isNaN(parsedAmount) || parsedAmount <= 0)) errs.amount = "Enter a valid positive amount.";
  }
  return errs;
}

/** Σ of the per-category amounts. */
export const categoryAmountsTotal = (form: TransactionFormValues, categories: string[]) =>
  categories.reduce((acc, cat) => acc + (parseFloat(form[`amount_${cat}`] || "0") || 0), 0);

/** Form state → request payload: numeric amount. */
export function toPayload(form: TransactionFormValues): TransactionFormValues {
  const payload = { ...form };
  if (payload.amount) payload.amount = parseFloat(payload.amount);
  return payload;
}

/** Copy the record-date field's value to `recordDate`. */
export function withRecordDate(payload: TransactionFormValues, layout: FormLayout | null | undefined, fieldMap: FieldMap): TransactionFormValues {
  const recordDateField = allFields(layout).find((f) => f.isRecordDate);
  if (!recordDateField) return payload;
  const fname = fieldNameFor(fieldMap, recordDateField.id);
  return payload[fname] ? { ...payload, recordDate: payload[fname] } : payload;
}

/** One payload per category, each with its own amount and without the `amount_<category>` keys. */
export function perCategoryPayloads(payload: TransactionFormValues, categories: string[]): TransactionFormValues[] {
  return categories.map((cat) => {
    const catPayload = { ...payload };
    catPayload.category = cat;
    catPayload.amount = parseFloat(catPayload[`amount_${cat}`] || "0");
    categories.forEach((c) => delete catPayload[`amount_${c}`]);
    return catPayload;
  });
}

export interface TransactionRequest {
  url: string;
  method: "POST" | "PUT";
  body: unknown;
}

/**
 * Which endpoint to call: several categories on create → bulk create; editing a group → bulk
 * replace; otherwise a single create/update.
 */
export function buildTransactionRequest(payload: TransactionFormValues, editTransaction: { id?: string } | null): TransactionRequest {
  const categories = selectedCategories(payload.category);
  if (categories.length > 1 && !editTransaction) {
    return { url: "/api/transactions/bulk", method: "POST", body: perCategoryPayloads(payload, categories) };
  }
  if (editTransaction) {
    if (isGroupId(editTransaction.id)) {
      return { url: `/api/transactions/bulk/${editTransaction.id}`, method: "PUT", body: perCategoryPayloads(payload, categories) };
    }
    return { url: `/api/transactions/${editTransaction.id}`, method: "PUT", body: payload };
  }
  return { url: "/api/transactions", method: "POST", body: payload };
}

/** Success toast text. */
export function successToast(form: TransactionFormValues, categoryCount: number, isEditMode: boolean): { title: string; description: string } {
  const on = new Date(form.date || Date.now()).toLocaleDateString("en-IN");
  return {
    title: isEditMode ? "Transaction updated!" : categoryCount > 1 ? "Transactions recorded!" : "Transaction recorded!",
    description:
      categoryCount > 1
        ? `Recorded ${categoryCount} items on ${on}`
        : `₹${parseFloat(form.amount || "0").toLocaleString("en-IN", { minimumFractionDigits: 2 })} ${form.type?.toLowerCase()} on ${on}`,
  };
}

/** 422 body `{ details | errors: { field: string | string[] } }` → first message per field; null otherwise. */
export function apiFieldErrors(status: number, data: { details?: unknown; errors?: unknown }): Record<string, string> | null {
  if (status !== 422 || !(data.details || data.errors)) return null;
  const raw = (data.details || data.errors) as Record<string, string | string[]>;
  return Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
}
