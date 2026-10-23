// Which job form values are money, so roles without "See amounts" never receive or overwrite them.
// Shared by the server (stripping and preserving) and the client (hiding sections).
import { JOB_FORM_FIELD_MAP, fieldNameFor } from "@/lib/forms/fieldMap";
import type { FormLayout } from "@/lib/forms/types";

/** The locked Financials section: package, discount, advance/installments, line-item rates. */
export const FINANCIAL_SECTION_ID = "sec_job_financial";
/** customData key holding the per-line-item rates. */
export const RATES_KEY = "fld_financial_rates";
/** customData key holding how each line was priced when saved ("piece" or an area unit such as "sqft", per rate key). */
export const UNITS_KEY = "fld_financial_units";

/** customData keys that hold money: every Financials field, any currency field, and the rates. */
export function moneyKeys(layout: FormLayout | null | undefined): Set<string> {
  const keys = new Set<string>([RATES_KEY, UNITS_KEY]);
  for (const section of layout?.sections ?? []) {
    for (const field of section.fields ?? []) {
      if (section.id === FINANCIAL_SECTION_ID || field.type === "CURRENCY") {
        keys.add(field.id);
        keys.add(fieldNameFor(JOB_FORM_FIELD_MAP, field.id));
      }
    }
  }
  return keys;
}

/** The layout without its Financials section and currency fields (what a role without amounts sees). */
export function layoutWithoutMoney(layout: FormLayout | null): FormLayout | null {
  if (!layout?.sections) return layout;
  return {
    ...layout,
    sections: layout.sections
      .filter((s) => s.id !== FINANCIAL_SECTION_ID)
      .map((s) => ({ ...s, fields: (s.fields ?? []).filter((f) => f.type !== "CURRENCY") })),
  };
}

/** A copy of `customData` without money values (repeatable entries included). */
export function withoutMoney(customData: Record<string, unknown>, keys: Set<string>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(customData)) {
    if (keys.has(key)) continue;
    out[key] = key.startsWith("rep_") ? stripEntries(value, keys) : value;
  }
  return out;
}

/** Repeatable entries (array or its JSON string) without money columns, in the same shape. */
function stripEntries(value: unknown, keys: Set<string>): unknown {
  let entries = value;
  if (typeof value === "string") {
    try {
      entries = JSON.parse(value);
    } catch {
      return value;
    }
  }
  if (!Array.isArray(entries)) return value;
  const stripped = entries.map((e) => (e && typeof e === "object" ? Object.fromEntries(Object.entries(e).filter(([k]) => !keys.has(k))) : e));
  return typeof value === "string" ? JSON.stringify(stripped) : stripped;
}

/**
 * For a save by someone who can't see amounts: their (stripped) customData with the stored money
 * values put back, so a hidden field is never blanked. Repeatable entries keep their stored money
 * columns by position.
 */
export function keepStoredMoney(incoming: Record<string, unknown>, stored: Record<string, unknown>, keys: Set<string>): Record<string, unknown> {
  const out = withoutMoney(incoming, keys);
  for (const key of keys) if (key in stored) out[key] = stored[key];
  for (const [key, value] of Object.entries(out)) {
    if (!key.startsWith("rep_") || !(key in stored)) continue;
    const parse = (v: unknown) => (typeof v === "string" ? safeParse(v) : v);
    const now = parse(value);
    const before = parse(stored[key]);
    if (!Array.isArray(now) || !Array.isArray(before)) continue;
    const merged = now.map((entry, i) => {
      const old = before[i];
      if (!entry || typeof entry !== "object" || !old || typeof old !== "object") return entry;
      const money = Object.fromEntries(Object.entries(old).filter(([k]) => keys.has(k)));
      return { ...entry, ...money };
    });
    out[key] = typeof value === "string" ? JSON.stringify(merged) : merged;
  }
  return out;
}

function safeParse(v: string): unknown {
  try {
    return JSON.parse(v);
  } catch {
    return v;
  }
}
