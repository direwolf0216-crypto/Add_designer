// Money-critical negative cases: bad input, tampered saves and edge values must never mis-bill.
import { describe, expect, it } from "vitest";
import { JOB_FORM_FIELD_MAP } from "@/lib/forms/fieldMap";
import type { FormLayout } from "@/lib/forms/types";
import { validateFieldValue } from "@/lib/forms/validation";
import { LAYOUT_TEMPLATES } from "@/lib/layout-builder/templates";
import { packageMismatch } from "../packageCheck";
import { splitIntoJobs } from "../multiJob";
import { computeJobTotals, computeLineItemsPackage, lineItemTotal, packageFromSavedValues, parseNonNegative, parseQuantity, type PricingRules } from "../pricing";

const layout = JSON.parse(JSON.stringify(LAYOUT_TEMPLATES.find((t) => t.id === "job-large-format")!.schema)) as FormLayout;
const SEC = "rep_sec_job_event";
const RULES: PricingRules = { "Flex Printing": { unit: "sqft", defaultRate: 25 }, Standee: { unit: "piece", defaultRate: 450 } };

/** customData exactly as saveJobAction stores it for one line. */
const saved = (line: { category: string; size?: string; qty?: string }, rate: string, unit: string, extra: Record<string, unknown> = {}) => ({
  [SEC]: JSON.stringify([{ category: line.category, fld_size: line.size ?? "", fld_qty: line.qty ?? "1" }]),
  fld_financial_rates: JSON.stringify({ [`${SEC}_0`]: rate }),
  fld_financial_units: JSON.stringify({ [`${SEC}_0`]: unit }),
  ...extra,
});

describe("packageMismatch: the server's check on every save", () => {
  const flex = saved({ category: "Flex Printing", size: "10 x 6 ft", qty: "2" }, "25", "sqft"); // 3,000

  it("accepts the package the lines add up to, within a paisa", () => {
    expect(packageMismatch(3000, flex, layout)).toBeNull();
    expect(packageMismatch(3000.01, flex, layout)).toBeNull();
    expect(packageMismatch(2999.99, flex, layout)).toBeNull();
    expect(packageMismatch(2950, { ...flex, fld_b_discount: "50" }, layout)).toBeNull();
  });

  it.each<[string, number, Record<string, unknown>]>([
    ["a lower total than the lines", 1, {}],
    ["a total two paise off", 3000.02, {}],
    ["a higher total than the lines", 3500, {}],
    ["zero when the lines are priced", 0, {}],
    ["the total before the discount", 3000, { fld_b_discount: "500" }],
  ])("rejects %s", (_label, pkg, extra) => {
    expect(packageMismatch(pkg, { ...flex, ...extra }, layout)).toMatch(/doesn't match the line items/);
  });

  it("rejects a negative or non-numeric total even without line items", () => {
    expect(packageMismatch(-1, {}, layout)).toBe("The total amount can't be negative.");
    expect(packageMismatch(NaN, {}, layout)).toBe("The total amount isn't a number.");
    expect(packageMismatch(Infinity, {}, layout)).toBe("The total amount isn't a number.");
  });

  it("allows a typed total when no line rates drive it", () => {
    expect(packageMismatch(1234, {}, layout)).toBeNull();
    expect(packageMismatch(1234, { [SEC]: JSON.stringify([{ category: "", fld_size: "", fld_qty: "1" }]) }, layout)).toBeNull();
  });

  it("prices with the units saved on the job, not today's rules", () => {
    // Saved per piece: 25 × 2 = 50, even though Flex is per ft² today.
    expect(packageMismatch(50, saved({ category: "Flex Printing", size: "10 x 6 ft", qty: "2" }, "25", "piece"), layout)).toBeNull();
    // An unknown saved unit falls back to per piece instead of trusting it.
    expect(packageMismatch(50, saved({ category: "Flex Printing", size: "10 x 6 ft", qty: "2" }, "25", "sqkm"), layout)).toBeNull();
  });

  it("can't be fooled by a negative rate, discount or quantity", () => {
    // Negative rate counts as zero, so a positive total no longer matches.
    expect(packageMismatch(3000, saved({ category: "Flex Printing", size: "10 x 6 ft", qty: "2" }, "-25", "sqft"), layout)).toMatch(/doesn't match/);
    expect(packageMismatch(0, saved({ category: "Flex Printing", size: "10 x 6 ft", qty: "2" }, "-25", "sqft"), layout)).toBeNull();
    // A negative discount doesn't add money.
    expect(packageMismatch(3500, { ...flex, fld_b_discount: "-500" }, layout)).toMatch(/doesn't match/);
    expect(packageMismatch(3000, { ...flex, fld_b_discount: "-500" }, layout)).toBeNull();
    // A negative quantity charges nothing.
    expect(packageMismatch(0, saved({ category: "Standee", qty: "-3" }, "450", "piece"), layout)).toBeNull();
    expect(packageMismatch(-1350, saved({ category: "Standee", qty: "-3" }, "450", "piece"), layout)).toBe("The total amount can't be negative.");
  });

  it("survives malformed saved data without throwing", () => {
    for (const bad of [
      { [SEC]: "not json", fld_financial_rates: "{", fld_financial_units: "[" },
      { [SEC]: JSON.stringify("a string"), fld_financial_rates: JSON.stringify([1, 2]) },
      { [SEC]: JSON.stringify([null, 5, "x"]) },
      { [SEC]: JSON.stringify([{ category: "Flex Printing", fld_size: { x: 1 }, fld_qty: ["2"] }]), fld_financial_rates: JSON.stringify({ [`${SEC}_0`]: { evil: true } }) },
    ]) {
      expect(() => packageMismatch(100, bad as Record<string, unknown>, layout)).not.toThrow();
    }
    expect(packageFromSavedValues({ [SEC]: "not json" }, layout, JOB_FORM_FIELD_MAP)).toBeNull();
  });
});

describe("quantity fields refuse what would mis-bill", () => {
  const qty = { name: "Quantity", type: "NUMBER", role: "quantity" as const };
  it.each([["-5", "Quantity can't be negative"], ["-0.5", "Quantity can't be negative"], ["abc", "Quantity must be a number"], ["2 pcs", "Quantity must be a number"], ["1.2.3", "Quantity must be a number"], ["1e3", "Quantity must be a number"], ["--1", "Quantity can't be negative"]])("%j → %s", (value, message) => {
    expect(validateFieldValue(qty, value)).toBe(message);
  });
  it.each(["1", "1,000", "1,00,000", "2.5", "0", " 3 ", ""])("%j is accepted", (value) => expect(validateFieldValue(qty, value)).toBeNull());
  it("still applies the layout's own minimum", () => {
    expect(validateFieldValue({ ...qty, validation: { min: 1 } }, "0")).toBe("Quantity must be at least 1");
  });
  it("leaves fields without the Quantity role alone", () => {
    expect(validateFieldValue({ name: "GSM", type: "NUMBER" }, "-5")).toBeNull();
  });
});

describe("parsers never produce negative money", () => {
  it.each([["-25", 0], ["25", 25], ["1,250.50", 1250.5], ["", 0], [undefined, 0], ["abc", 0], [null, 0]])("parseNonNegative(%j) = %s", (v, n) => expect(parseNonNegative(v)).toBe(n));
  it.each([["-5", 0], ["0", 0], ["", 1], ["1,000", 1000], [7, 7], [-7, 0], [NaN, 1], ["Infinity", 1]])("parseQuantity(%j) = %s", (v, n) => expect(parseQuantity(v)).toBe(n));
  it("line totals stay at zero or above for any sign combination", () => {
    for (const rate of ["-10", "0", "10"]) for (const q of ["-2", "0", "2"]) expect(lineItemTotal(rate, q, "sqft", "10 x 6")).toBeGreaterThanOrEqual(0);
  });
});

describe("form totals with hostile values", () => {
  const rep = { [SEC]: [{ category: "Standee", fld_size: "", fld_qty: "2" }] };
  const totals = (values: Record<string, unknown>, rate = "450", installments: { amount: string; date: string; paymentMode: string }[] = []) =>
    computeJobTotals({ values, installments, repeatableData: rep, financialRates: { [`${SEC}_0`]: rate }, layout, fieldMap: JOB_FORM_FIELD_MAP, rules: RULES });
  it("ignores a negative discount instead of adding it", () => expect(totals({ fld_b_discount: "-500" }).package).toBe("900"));
  it("treats a negative rate as zero", () => expect(totals({}, "-450").package).toBe("0"));
  it("reads a discount with digit grouping", () => expect(totals({ fld_b_discount: "1,00" }).package).toBe("800"));
  it("never shows a negative balance after over-payment", () => expect(totals({}, "450", [{ amount: "5000", date: "", paymentMode: "Cash" }]).due).toBe("0.00"));
  it("computes a lakh-sized area order without rounding drift", () => {
    const big = computeLineItemsPackage({ [SEC]: [{ category: "Flex Printing", fld_size: "40 x 20 ft", fld_qty: "1,000" }] }, { [`${SEC}_0`]: "25" }, layout, JOB_FORM_FIELD_MAP, RULES);
    expect(big.total).toBe(20_000_000);
  });
});

describe("splitting jobs with hostile values", () => {
  it("never spreads a negative discount across jobs", () => {
    const splits = splitIntoJobs({ layout, fieldMap: JOB_FORM_FIELD_MAP, repeatableData: { [SEC]: [{ category: "Standee", fld_size: "", fld_qty: "1" }, { category: "Standee", fld_size: "", fld_qty: "1" }] }, financialRates: { [`${SEC}_0`]: "450", [`${SEC}_1`]: "450" }, installments: [], discount: -100, fallbackPackage: 0, rules: RULES });
    expect(splits.map((s) => s.packageAmount)).toEqual([450, 450]);
  });
});
