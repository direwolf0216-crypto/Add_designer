import { describe, expect, it } from "vitest";
import { JOB_FORM_FIELD_MAP, TRANSACTION_FIELD_MAP } from "../fieldMap";
import { evaluateVisibility, formValueLookup, isVisibleIn } from "../visibility";

describe("evaluateVisibility", () => {
  const values = { status: "Printing", category: "Flex, Posters", fld_custom: "yes", tags: ["a", "b"] };

  it("is visible without a rule or without a dependency", () => {
    expect(isVisibleIn(undefined, values, JOB_FORM_FIELD_MAP)).toBe(true);
    expect(isVisibleIn(null, values, JOB_FORM_FIELD_MAP)).toBe(true);
    expect(isVisibleIn({ operator: "EQUALS", value: "x" }, values, JOB_FORM_FIELD_MAP)).toBe(true);
  });

  it("maps layout ids to form keys (fld_b_status → status)", () => {
    expect(isVisibleIn({ fieldId: "fld_b_status", operator: "EQUALS", value: "Printing" }, values, JOB_FORM_FIELD_MAP)).toBe(true);
    expect(isVisibleIn({ fieldId: "fld_b_status", operator: "EQUALS", values: ["Pending"] }, values, JOB_FORM_FIELD_MAP)).toBe(false);
    expect(isVisibleIn({ dependsOn: "fld_b_status", operator: "NOT_EQUALS", values: ["Pending"] }, values, JOB_FORM_FIELD_MAP)).toBe(true);
  });

  it("falls back to the raw id when the mapped key is undefined", () => {
    expect(isVisibleIn({ fieldId: "fld_custom", operator: "EQUALS", value: "yes" }, values, JOB_FORM_FIELD_MAP)).toBe(true);
    const lookup = formValueLookup({ fld_tx_type: "EXPENSE" });
    expect(evaluateVisibility({ fieldId: "fld_tx_type", operator: "EQUALS", value: "EXPENSE" }, lookup, TRANSACTION_FIELD_MAP)).toBe(true);
  });

  it("CONTAINS works on strings and arrays, false otherwise", () => {
    expect(isVisibleIn({ fieldId: "fld_b_job_category", operator: "CONTAINS", value: "Flex" }, values, JOB_FORM_FIELD_MAP)).toBe(true);
    expect(isVisibleIn({ fieldId: "tags", operator: "CONTAINS", values: ["z", "b"] }, values, JOB_FORM_FIELD_MAP)).toBe(true);
    expect(isVisibleIn({ fieldId: "missing", operator: "CONTAINS", value: "x" }, values, JOB_FORM_FIELD_MAP)).toBe(false);
  });

  it("supports the legacy { dependsOn, values } format without operator", () => {
    expect(isVisibleIn({ dependsOn: "fld_b_status", values: ["Printing"] }, values, JOB_FORM_FIELD_MAP)).toBe(true);
    expect(isVisibleIn({ dependsOn: "fld_b_status", values: ["Pending"] }, values, JOB_FORM_FIELD_MAP)).toBe(false);
    // fieldId-only rule without operator is always visible
    expect(isVisibleIn({ fieldId: "fld_b_status", values: ["Pending"] }, values, JOB_FORM_FIELD_MAP)).toBe(true);
  });

  it("treats unknown operators as visible", () => {
    expect(isVisibleIn({ fieldId: "fld_b_status", operator: "GREATER", value: "1" }, values, JOB_FORM_FIELD_MAP)).toBe(true);
  });
});
