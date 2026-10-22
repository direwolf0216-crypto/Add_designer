// Field validation beyond "required": numeric bounds, text length and well-known formats.
import type { FieldValidation, FormField } from "./types";

export const VALIDATION_PATTERNS: Record<Exclude<NonNullable<FieldValidation["pattern"]>, "custom">, { label: string; regex: RegExp; message: string }> = {
  phone: { label: "Indian mobile number", regex: /^(?:\+91[\s-]?|0)?[6-9]\d{9}$/, message: "Enter a 10-digit mobile number" },
  email: { label: "Email address", regex: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, message: "Enter a valid email address" },
  pincode: { label: "PIN code", regex: /^[1-9]\d{5}$/, message: "Enter a 6-digit PIN code" },
  gstin: { label: "GSTIN", regex: /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/i, message: "Enter a valid 15-character GSTIN" },
};

const NUMERIC_TYPES = new Set(["NUMBER", "DECIMAL", "CURRENCY", "PERCENTAGE"]);

/** Whether the type takes numeric bounds (min / max) rather than text length. */
export const isNumericType = (type: string | undefined) => NUMERIC_TYPES.has(type ?? "");

const isBlank = (v: unknown) => v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);

/**
 * The error for a value under the field's validation settings, or null. Blank values pass (required is
 * checked separately); a custom message replaces the default wording for any failed check.
 */
export function validateFieldValue(field: Pick<FormField, "name" | "type" | "validation">, value: unknown): string | null {
  const v = field.validation;
  if (!v || isBlank(value)) return null;
  const fail = (msg: string) => v.message?.trim() || msg;
  const text = Array.isArray(value) ? value.join(", ") : String(value);

  if (isNumericType(field.type)) {
    const n = parseFloat(text.replace(/,/g, ""));
    if (Number.isNaN(n)) return fail(`${field.name} must be a number`);
    if (v.min !== undefined && n < v.min) return fail(`${field.name} must be at least ${v.min}`);
    if (v.max !== undefined && n > v.max) return fail(`${field.name} must be at most ${v.max}`);
    return null;
  }

  if (v.minLength !== undefined && text.length < v.minLength) return fail(`${field.name} needs at least ${v.minLength} characters`);
  if (v.maxLength !== undefined && text.length > v.maxLength) return fail(`${field.name} can have at most ${v.maxLength} characters`);

  if (v.pattern === "custom") {
    if (v.regex) {
      try {
        if (!new RegExp(v.regex).test(text)) return fail(`${field.name} is not in the expected format`);
      } catch {
        return null; // an invalid regex never blocks saving
      }
    }
  } else if (v.pattern) {
    const p = VALIDATION_PATTERNS[v.pattern];
    if (p && !p.regex.test(text.trim())) return fail(p.message);
  }
  return null;
}

/** True when the field has any validation setting that can fail. */
export const hasValidation = (field: Pick<FormField, "validation">) => {
  const v = field.validation;
  return !!v && (v.min !== undefined || v.max !== undefined || v.minLength !== undefined || v.maxLength !== undefined || !!v.pattern);
};
