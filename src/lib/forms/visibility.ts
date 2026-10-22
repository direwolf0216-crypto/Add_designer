import { fieldNameFor } from "./fieldMap";
import type { FieldMap, VisibilityCondition, VisibilityRule } from "./types";

/**
 * Reads the current value of the field a rule depends on.
 * `fieldName` is the mapped form key, `fieldId` the raw layout id from the rule.
 */
export type ValueLookup = (fieldName: string, fieldId: string) => unknown;

/** Form-state lookup: the mapped key wins when it is defined, otherwise the raw id. */
export const formValueLookup =
  (values: Record<string, unknown>): ValueLookup =>
  (fieldName, fieldId) =>
    values[fieldName] !== undefined ? values[fieldName] : values[fieldId];

/** Placeholder a date condition may use instead of a fixed day. */
export const TODAY_TOKEN = "@today";

const isEmpty = (v: unknown) =>
  v === undefined || v === null || v === "" || v === false || v === "false" || (Array.isArray(v) && v.length === 0);

const asNumber = (v: unknown): number | null => {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  const n = parseFloat(v.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
};

const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** yyyy-MM-dd from a date string, ISO instant or the today token; null when unreadable. */
const asDay = (v: unknown): string | null => {
  if (v === TODAY_TOKEN) return localToday();
  if (typeof v !== "string" || !v) return null;
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(v);
  if (m) return m[1];
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
};

/** One condition against the current value of its field. */
export function evaluateCondition(cond: VisibilityCondition, lookup: ValueLookup, fieldMap: FieldMap): boolean {
  if (!cond.fieldId) return true;
  const depValue = lookup(fieldNameFor(fieldMap, cond.fieldId), cond.fieldId);
  const values = cond.values ?? [];
  const first = values[0];

  switch (cond.operator) {
    case "EQUALS":
      if (Array.isArray(depValue)) return values.some((v) => (depValue as unknown[]).includes(v));
      if (typeof depValue === "boolean") return values.includes(String(depValue));
      return values.includes(depValue as string);
    case "NOT_EQUALS":
      if (Array.isArray(depValue)) return !values.some((v) => (depValue as unknown[]).includes(v));
      if (typeof depValue === "boolean") return !values.includes(String(depValue));
      return !values.includes(depValue as string);
    case "CONTAINS":
      if (typeof depValue === "string" || Array.isArray(depValue)) {
        return values.some((v) => (depValue as string | unknown[]).includes(v));
      }
      return false;
    case "IS_EMPTY":
      return isEmpty(depValue);
    case "IS_NOT_EMPTY":
      return !isEmpty(depValue);
    case "GREATER_THAN": {
      const a = asNumber(depValue), b = asNumber(first);
      return a !== null && b !== null && a > b;
    }
    case "LESS_THAN": {
      const a = asNumber(depValue), b = asNumber(first);
      return a !== null && b !== null && a < b;
    }
    case "BEFORE": {
      const a = asDay(depValue), b = asDay(first);
      return !!a && !!b && a < b;
    }
    case "AFTER": {
      const a = asDay(depValue), b = asDay(first);
      return !!a && !!b && a > b;
    }
    default:
      return true;
  }
}

/** The conditions of a rule, with a legacy single-condition rule lifted into the list. */
export function ruleConditions(rule: VisibilityRule | null | undefined): VisibilityCondition[] {
  if (!rule) return [];
  if (rule.conditions && rule.conditions.length > 0) return rule.conditions;
  const fieldId = rule.dependsOn || rule.fieldId;
  if (!fieldId) return [];
  const values = rule.values || (rule.value ? [rule.value] : []);
  // Legacy `{ dependsOn, values }` without an operator meant EQUALS.
  return [{ fieldId, operator: rule.operator || "EQUALS", values }];
}

/**
 * Whether a section/field with this visibility rule is shown. A missing rule, or a rule without any
 * condition, means "always visible". Unknown operators also mean visible.
 */
export function evaluateVisibility(
  rule: VisibilityRule | null | undefined,
  lookup: ValueLookup,
  fieldMap: FieldMap
): boolean {
  const conditions = ruleConditions(rule);
  if (conditions.length === 0) return true;
  const results = conditions.map((c) => evaluateCondition(c, lookup, fieldMap));
  return rule?.match === "any" ? results.some(Boolean) : results.every(Boolean);
}

/** Visibility against a flat values object (the job and transaction forms). */
export function isVisibleIn(
  rule: VisibilityRule | null | undefined,
  values: Record<string, unknown>,
  fieldMap: FieldMap
): boolean {
  return evaluateVisibility(rule, formValueLookup(values), fieldMap);
}

/** A rule with no live condition (empty or incomplete) is treated as absent. */
export const hasConditions = (rule: VisibilityRule | null | undefined) => ruleConditions(rule).some((c) => !!c.fieldId);
