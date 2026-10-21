import { fieldNameFor } from "./fieldMap";
import type { FieldMap, VisibilityRule } from "./types";

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

/**
 * Whether a section/field with this visibility rule is shown. A missing rule, or a rule without a
 * dependency, means "always visible". Unknown operators also mean visible.
 */
export function evaluateVisibility(
  rule: VisibilityRule | null | undefined,
  lookup: ValueLookup,
  fieldMap: FieldMap
): boolean {
  if (!rule) return true;

  const dependsOnKey = rule.dependsOn || rule.fieldId;
  if (!dependsOnKey) return true;

  const depValue = lookup(fieldNameFor(fieldMap, dependsOnKey), dependsOnKey);
  const ruleValues: string[] = rule.values || (rule.value ? [rule.value] : []);

  if (rule.operator === "EQUALS") return ruleValues.includes(depValue as string);
  if (rule.operator === "NOT_EQUALS") return !ruleValues.includes(depValue as string);
  if (rule.operator === "CONTAINS") {
    if (typeof depValue === "string" || Array.isArray(depValue)) {
      return ruleValues.some((v) => (depValue as string | unknown[]).includes(v));
    }
    return false;
  }

  // Legacy `{ dependsOn, values }` format without an operator.
  if (rule.dependsOn && Array.isArray(rule.values) && !rule.operator) {
    return rule.values.includes(depValue as string);
  }

  return true;
}

/** Visibility against a flat values object (the job and transaction forms). */
export function isVisibleIn(
  rule: VisibilityRule | null | undefined,
  values: Record<string, unknown>,
  fieldMap: FieldMap
): boolean {
  return evaluateVisibility(rule, formValueLookup(values), fieldMap);
}
