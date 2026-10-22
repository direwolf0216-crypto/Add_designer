import { describe, expect, it } from "vitest";
import { hasConditions, isVisibleIn, ruleConditions } from "../visibility";

const map = { fld_cat: "category" };

describe("visibility rules", () => {
  it("keeps legacy single-condition rules working", () => {
    expect(isVisibleIn({ fieldId: "fld_cat", operator: "EQUALS", values: ["Flex"] }, { category: "Flex" }, map)).toBe(true);
    expect(isVisibleIn({ dependsOn: "fld_cat", values: ["Flex"] }, { category: "Cards" }, map)).toBe(false);
    expect(isVisibleIn(null, {}, map)).toBe(true);
  });

  it("joins several conditions with all or any", () => {
    const rule = { match: "all" as const, conditions: [
      { fieldId: "fld_cat", operator: "EQUALS", values: ["Flex"] },
      { fieldId: "qty", operator: "GREATER_THAN", values: ["10"] },
    ] };
    expect(isVisibleIn(rule, { category: "Flex", qty: "12" }, map)).toBe(true);
    expect(isVisibleIn(rule, { category: "Flex", qty: "5" }, map)).toBe(false);
    expect(isVisibleIn({ ...rule, match: "any" }, { category: "Cards", qty: "50" }, map)).toBe(true);
  });

  it("supports empty, numeric and date operators", () => {
    expect(isVisibleIn({ conditions: [{ fieldId: "notes", operator: "IS_EMPTY" }] }, { notes: "" }, map)).toBe(true);
    expect(isVisibleIn({ conditions: [{ fieldId: "notes", operator: "IS_NOT_EMPTY" }] }, { notes: "x" }, map)).toBe(true);
    expect(isVisibleIn({ conditions: [{ fieldId: "amt", operator: "LESS_THAN", values: ["1,000"] }] }, { amt: "999" }, map)).toBe(true);
    expect(isVisibleIn({ conditions: [{ fieldId: "due", operator: "BEFORE", values: ["2026-12-01"] }] }, { due: "2026-11-30" }, map)).toBe(true);
    expect(isVisibleIn({ conditions: [{ fieldId: "due", operator: "AFTER", values: ["@today"] }] }, { due: "2999-01-01" }, map)).toBe(true);
    expect(isVisibleIn({ conditions: [{ fieldId: "chk", operator: "EQUALS", values: ["true"] }] }, { chk: true }, map)).toBe(true);
  });

  it("treats an incomplete rule as absent", () => {
    expect(hasConditions({ conditions: [{ fieldId: "", operator: "EQUALS" }] })).toBe(false);
    expect(ruleConditions({ fieldId: "a", values: ["1"] })).toEqual([{ fieldId: "a", operator: "EQUALS", values: ["1"] }]);
  });
});
