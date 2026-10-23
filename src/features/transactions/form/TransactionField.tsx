"use client";

import FieldRenderer from "@/components/forms/FieldRenderer";
import { FieldShell } from "@/components/forms/fields/FieldChrome";
import MultiSelectField from "@/components/forms/fields/MultiSelectField";
import { TRANSACTION_FIELD_MAP, fieldNameFor } from "@/lib/forms/fieldMap";
import type { FormField } from "@/lib/forms/types";
import { selectedCategories, type TransactionFormValues } from "@/lib/transactions/formMapping";
import { isVisibleIn } from "@/lib/forms/visibility";
import CategoryAmountsEditor from "./CategoryAmountsEditor";
import LockedField from "@/components/forms/fields/LockedField";

export interface TransactionFieldProps {
  field: FormField;
  form: TransactionFormValues;
  errors: Record<string, string>;
  set: (key: string) => (value: any) => void;
  driveStatus?: { connected: boolean };
}

/**
 * One transaction-form field. Amount, type and category have bespoke inputs (amount is replaced by
 * per-category amounts when several categories are picked); the rest go through FieldRenderer.
 */
export default function TransactionField({ field: rawField, form, errors, set, driveStatus }: TransactionFieldProps) {
  const fieldName = fieldNameFor(TRANSACTION_FIELD_MAP, rawField.id);
  const isError = !!errors[fieldName];
  // "Required when" rules show the asterisk only while they hold.
  const mandatory = !!rawField.mandatory || (!!rawField.mandatoryRule && isVisibleIn(rawField.mandatoryRule, form, TRANSACTION_FIELD_MAP));
  const field: FormField = mandatory === !!rawField.mandatory ? rawField : { ...rawField, mandatory };
  if (field.lockedForViewer) {
    return (
      <FieldShell label={field.name} mandatory={field.mandatory} errorMessage={errors[fieldName]}>
        <LockedField field={field} value={form[fieldName]} variant="transaction" />
      </FieldShell>
    );
  }

  if (fieldName === "amount") {
    if (selectedCategories(form.category).length > 1) return null;
    return (
      <FieldShell label={field.name} mandatory={field.mandatory} errorMessage={errors[fieldName]}>
        <div className={`bg-white rounded-2xl border p-4 flex items-center gap-3 focus-within:ring-2 focus-within:ring-orange-500/20 transition-all shadow-sm ${isError ? "border-red-400" : "border-slate-200 focus-within:border-orange-400"}`}>
          <span className="text-2xl font-medium text-slate-400">₹</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form[fieldName] || ""}
            onChange={(e) => set(fieldName)(e.target.value)}
            placeholder={field.placeholder || "0.00"}
            className="w-full bg-transparent border-none outline-none text-4xl font-extrabold text-slate-900 placeholder:text-slate-200 appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]"
          />
        </div>
      </FieldShell>
    );
  }

  if (fieldName === "type" || (field.options?.includes("INCOME") && field.options?.includes("EXPENSE"))) {
    return (
      <FieldShell label={field.name} mandatory={field.mandatory} errorMessage={errors[fieldName]}>
        <div className="flex bg-slate-50 rounded-xl border border-slate-200 p-1 h-[45px]">
          <button
            type="button"
            onClick={() => set(fieldName)("INCOME")}
            className={`flex-1 text-sm font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all ${form[fieldName] === "INCOME" ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/30" : "text-slate-500 hover:text-emerald-600 hover:bg-emerald-50"}`}
          >
            <i className="ph ph-trend-up"></i> Income
          </button>
          <button
            type="button"
            onClick={() => set(fieldName)("EXPENSE")}
            className={`flex-1 text-sm font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all ${form[fieldName] === "EXPENSE" ? "bg-rose-500 text-white shadow-md shadow-rose-500/30" : "text-slate-500 hover:text-rose-600 hover:bg-rose-50"}`}
          >
            <i className="ph ph-trend-down"></i> Expense
          </button>
        </div>
      </FieldShell>
    );
  }

  const common = {
    field,
    name: fieldName,
    value: form[fieldName],
    onChange: set(fieldName),
    error: isError,
    errorMessage: errors[fieldName],
    variant: "transaction" as const,
  };

  // A multi-select category splits the amount per category; a single-choice one is a plain dropdown.
  if (fieldName === "category" && field.type === "MULTI_SELECT") {
    return (
      <FieldShell
        label={field.name}
        mandatory={field.mandatory}
        errorMessage={errors[fieldName]}
        after={<CategoryAmountsEditor categories={selectedCategories(form[fieldName] || "")} form={form} errors={errors} set={set} />}
      >
        <MultiSelectField {...common} />
      </FieldShell>
    );
  }

  return (
    <FieldRenderer
      {...common}
      context={{ driveStatus, moduleName: "Transactions", categoryName: form.category || "Uncategorized" }}
    />
  );
}
