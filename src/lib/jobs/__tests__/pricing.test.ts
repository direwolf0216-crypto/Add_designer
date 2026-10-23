import { describe, expect, it } from "vitest";
import { JOB_FORM_FIELD_MAP } from "@/lib/forms/fieldMap";
import type { FormLayout } from "@/lib/forms/types";
import {
  parseAreaSqFt,
  advanceFromInstallments,
  computeJobTotals,
  computeLineItemsPackage,
  findDiscountKey,
  formatCurrencyInput,
  installmentsTotal,
  lineItemRows,
  lineItemTotal,
  outstandingBalance,
  packageAmount,
  parseCurrency,
  payableInstallments,
  sumLineItems,
} from "../pricing";

const map = JOB_FORM_FIELD_MAP;
const layout: FormLayout = {
  sections: [
    {
      id: "items",
      isRepeatable: true,
      fields: [
        { id: "fld_item_cat", name: "Job Category", type: "PICK_LIST", options: ["Flex", "Posters"] },
        { id: "fld_item_size", name: "Size", type: "SINGLE_LINE" },
        { id: "fld_item_qty", name: "Qty", type: "NUMBER" },
      ],
    },
    {
      id: "sec_job_financial",
      fields: [
        { id: "fld_b_package", name: "Total Amount", type: "CURRENCY" },
        { id: "fld_discount", name: "Discount", type: "CURRENCY" },
        { id: "fld_b_advance", name: "Advance", type: "CURRENCY" },
      ],
    },
  ],
};
const inst = (amount: string) => ({ amount, date: "2026-01-01", paymentMode: "Cash" });

describe("currency helpers", () => {
  it("parses and formats", () => {
    expect(parseCurrency("1,250.50")).toBe(1250.5);
    expect(parseCurrency("")).toBe(0);
    expect(formatCurrencyInput(125000.5)).toBe("1,25,000.50");
    expect(packageAmount("1,200")).toBe(1200);
    expect(packageAmount(undefined)).toBe(0);
  });

  it("sums installments (form value tolerates commas; display uses parseFloat)", () => {
    expect(advanceFromInstallments([inst("1,000"), inst("500")])).toBe(1500);
    expect(installmentsTotal([inst("1,000"), inst("500")])).toBe(501);
    expect(payableInstallments([inst("0"), inst(""), inst("10")])).toEqual([inst("10")]);
    expect(outstandingBalance("1,000", [inst("400")])).toBe(600);
    expect(outstandingBalance("100", [inst("400")])).toBe(0);
  });
});

describe("line items", () => {
  const repeatableData = {
    rep_items: [
      { fld_item_cat: "Flex", fld_item_size: "10x4", fld_item_qty: "3" },
      { fld_item_cat: "Posters", fld_item_qty: "" },
      { fld_item_size: "A4", fld_item_qty: "5" }, // no category: not priced
    ],
  };
  const rates = { rep_items_0: "100", rep_items_1: "1,000", rep_items_2: "7" };

  it("prices entries with a category at rate × qty (qty defaults to 1)", () => {
    expect(computeLineItemsPackage(repeatableData, rates, layout, map)).toEqual({ hasRates: true, total: 1300 });
    expect(computeLineItemsPackage({ rep_items: [{ fld_item_qty: "2" }] }, rates, layout, map)).toEqual({ hasRates: false, total: 0 });
  });

  it("lists rate rows with size/qty in the label", () => {
    const rows = lineItemRows(repeatableData, layout, map);
    expect(rows.map((r) => [r.rateKey, r.category, r.extraText, r.qty])).toEqual([
      ["rep_items_0", "Flex", " (10x4, Qty: 3)", "3"],
      ["rep_items_1", "Posters", "", ""],
    ]);
    expect(lineItemTotal("100", "3")).toBe(300);
    expect(lineItemTotal(undefined, "")).toBe(0);
  });

  it("sums every entry for the line-items total (grouped rates read whole, category not required)", () => {
    // 100×3 + 1,000×1 + 7×5: the shown sum reads "1,000" like the package does
    expect(sumLineItems(repeatableData, rates, layout, map)).toBe(1335);
  });

  it("finds the discount key by layout field name", () => {
    expect(findDiscountKey({ title: "x" }, layout, map)).toBe("fld_discount");
    expect(findDiscountKey({ my_discount: "5" }, null, map)).toBe("my_discount");
    expect(findDiscountKey({ title: "x" }, null, map)).toBeUndefined();
  });
});

describe("computeJobTotals", () => {
  const repeatableData = { rep_items: [{ fld_item_cat: "Flex", fld_item_qty: "2" }] };

  it("derives advance from installments, package from rates − discount, and due", () => {
    const totals = computeJobTotals({
      values: { package: "", advance: "", fld_discount: "50" },
      installments: [inst("100"), inst("50")],
      repeatableData,
      financialRates: { rep_items_0: "200" },
      layout,
      fieldMap: map,
    });
    expect(totals).toEqual({ advance: "150", package: "350", due: "200.00" });
  });

  it("leaves package alone without priced line items and blanks due when nothing is owed", () => {
    expect(
      computeJobTotals({ values: { package: "1000", advance: "" }, installments: [], repeatableData: {}, financialRates: {}, layout, fieldMap: map })
    ).toEqual({ due: "1,000.00" });
    expect(
      computeJobTotals({ values: { package: "", advance: "" }, installments: [inst("")], repeatableData: {}, financialRates: {}, layout, fieldMap: map })
    ).toEqual({ advance: "", due: "" });
  });

  it("does not rewrite an unchanged package", () => {
    const totals = computeJobTotals({
      values: { package: "400", advance: "" },
      installments: [],
      repeatableData,
      financialRates: { rep_items_0: "200" },
      layout,
      fieldMap: map,
    });
    expect(totals).toEqual({ due: "400.00" });
  });
});


describe("per-square-foot pricing", () => {
  it("reads areas from common size formats", () => {
    expect(parseAreaSqFt("10 x 6")).toBe(60);
    expect(parseAreaSqFt("4*6 ft")).toBe(24);
    expect(parseAreaSqFt("3.5 x 2 in")).toBeCloseTo(0.049, 3);
    expect(parseAreaSqFt("120 x 60 cm")).toBeCloseTo(7.75, 2);
    expect(parseAreaSqFt("A4")).toBeNull();
    expect(parseAreaSqFt("")).toBeNull();
  });
  it("multiplies rate by area and quantity for sqft lines, by quantity otherwise", () => {
    expect(lineItemTotal("25", "2", "sqft", "10 x 6")).toBe(3000);
    expect(lineItemTotal("25", "2", "piece", "10 x 6")).toBe(50);
    // Unreadable size: falls back to per piece so the total is never silently zero.
    expect(lineItemTotal("25", "2", "sqft", "A4")).toBe(50);
  });
});
