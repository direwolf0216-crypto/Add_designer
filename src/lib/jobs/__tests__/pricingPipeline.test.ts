// Money-critical, end to end without a browser: the job form's numbers → the multi-job split → the
// FormData sent to saveJobAction → what the server stores → Job Details → the printed invoice. Every
// screen must show the same money, and later pricing changes must never reprice a saved job.
import { describe, expect, it } from "vitest";
import { JOB_DETAILS_FIELD_MAP, JOB_FORM_FIELD_MAP } from "@/lib/forms/fieldMap";
import type { FormLayout, RepeatableData } from "@/lib/forms/types";
import { LAYOUT_TEMPLATES } from "@/lib/layout-builder/templates";
import { parseAmount, round2 } from "@/lib/money";
import { buildInvoiceViewModel } from "@/components/invoices/utils/invoiceLogic";
import { buildJobFormData } from "../formMapping";
import { splitIntoJobs, splitProportionally } from "../multiJob";
import { computeJobTotals, computeLineItemsPackage, lineItemRows, sumLineItems, type FinancialRates, type Installment, type PricingRules } from "../pricing";
import { normalizeJob, resolveJobSummary, resolveSpecEntries } from "../resolveJobFields";

// The real "Large format" template, with a Size field offering ft, in, cm, sqft and a shop unit (pcs).
const template = LAYOUT_TEMPLATES.find((t) => t.id === "job-large-format")!;
const layout = JSON.parse(JSON.stringify(template.schema)) as FormLayout;
const sizeField = layout.sections.flatMap((s) => s.fields).find((f) => f.id === "fld_size")!;
sizeField.sizeUnits = ["ft", "in", "cm", "sqft", "pcs"];
const SEC = "rep_sec_job_event";

const RULES: PricingRules = {
  "Flex Printing": { unit: "sqft", defaultRate: 25 },
  "Vinyl Printing": { unit: "sqin", defaultRate: 0.5 },
  Banner: { unit: "sqcm", defaultRate: 0.02 },
  Standee: { unit: "piece", defaultRate: 450 },
  "Lighting Board": { unit: "sqm", defaultRate: 400 },
};

type Line = { category: string; size: string; qty: string; rate: string };
const entry = (l: Line) => ({ category: l.category, fld_size: l.size, fld_qty: l.qty, fld_b_date: "2026-10-23", fld_due_date: "2026-10-30" });
const repeatable = (lines: Line[]): RepeatableData => ({ [SEC]: lines.map(entry) });
const ratesOf = (lines: Line[]): FinancialRates => Object.fromEntries(lines.map((l, i) => [`${SEC}_${i}`, l.rate]));

const LINES: Line[] = [
  { category: "Flex Printing", size: "10 x 6 ft", qty: "2", rate: "25" }, // 60 sq ft × 2 × 25 = 3,000
  { category: "Vinyl Printing", size: "3.5 x 2 in", qty: "3", rate: "0.5" }, // 7 sq in × 3 × 0.5 = 10.50
  { category: "Banner", size: "120 x 60 cm", qty: "1", rate: "0.02" }, // 7,200 sq cm × 0.02 = 144
  { category: "Standee", size: "6 x 2 ft", qty: "2", rate: "450" }, // per piece: 900
  { category: "Lighting Board", size: "2 x 3 m", qty: "1", rate: "400" }, // m isn't a Size-field unit here, but still readable: 6 sq m × 400 = 2,400
];
const EXPECTED_LINES = [3000, 10.5, 144, 900, 2400];
const SUM = 6454.5;

const baseValues = { title: "Rahul Prints", phone: "9876543210", date: "2026-10-23", status: "Pending", fld_b_discount: "54.50" };

/** What saveJobAction stores: string entries outside the standard keys go to customData; the package is rounded to paise. */
const STANDARD = new Set(["id", "title", "category", "date", "time", "location", "phone", "email", "package", "advance", "due", "status", "installments", "packageName", "inclusions", "notes", "attachments", "assigneeIds", "finishingStatus", "proofDelivered", "customData", "recordDate", "jobNumber"]);
function saveLikeServer(fd: FormData, id: string) {
  const raw = Object.fromEntries(fd.entries()) as Record<string, string>;
  const customData: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) if (!STANDARD.has(k) && typeof v === "string") customData[k] = v;
  const pkg = round2(parseAmount(raw.package));
  return {
    id,
    category: raw.category,
    date: new Date("2026-10-23"),
    dueDate: new Date("2026-10-30"),
    location: "Chennai",
    packageName: raw.category,
    customData,
    order: { package: pkg },
    client: { name: raw.title, phone: raw.phone, email: "" },
    assignments: [],
    installments: JSON.parse(raw.installments || "[]") as Installment[],
  };
}
const invoiceStub = { id: "inv", invoiceNumber: "INV-1", jobId: "job", discount: 0, createdAt: new Date("2026-10-23"), dueDate: new Date("2026-10-30"), lineItems: [] } as never;
const incomes = (amounts: number[]) => amounts.map((amount, i) => ({ id: `t${i}`, type: "INCOME", amount, deletedAt: null, date: new Date("2026-10-23") })) as never;
const rs = (n: number) => `Rs ${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function detailsOf(saved: ReturnType<typeof saveLikeServer>, rules: PricingRules) {
  const job = normalizeJob(saved);
  return resolveSpecEntries(job, layout, JOB_DETAILS_FIELD_MAP, resolveJobSummary(job, layout, JOB_DETAILS_FIELD_MAP), rules);
}
const invoiceOf = (saved: ReturnType<typeof saveLikeServer>, rules: PricingRules, paid: number[] = [], settings: Record<string, string> = {}) =>
  buildInvoiceViewModel(invoiceStub, saved as never, incomes(paid), settings, undefined, layout, rules).print;

describe("job form totals", () => {
  it("prices each line by its category's unit and takes the discount off the sum", () => {
    const rows = lineItemRows(repeatable(LINES), layout, JOB_FORM_FIELD_MAP);
    expect(rows.map((r) => r.category)).toEqual(LINES.map((l) => l.category));
    expect(sumLineItems(repeatable(LINES), ratesOf(LINES), layout, JOB_FORM_FIELD_MAP, RULES)).toBeCloseTo(SUM, 10);
    const totals = computeJobTotals({ values: { ...baseValues }, installments: [{ amount: "1,000", date: "2026-10-23", paymentMode: "Cash" }], repeatableData: repeatable(LINES), financialRates: ratesOf(LINES), layout, fieldMap: JOB_FORM_FIELD_MAP, rules: RULES });
    expect(totals).toEqual({ advance: "1000", package: "6400", due: "5,400.00" });
  });

  it("never lets the package or the balance go negative", () => {
    const run = (discount: string, paid: string) =>
      computeJobTotals({ values: { fld_b_discount: discount }, installments: paid ? [{ amount: paid, date: "", paymentMode: "Cash" }] : [], repeatableData: repeatable(LINES.slice(0, 1)), financialRates: ratesOf(LINES.slice(0, 1)), layout, fieldMap: JOB_FORM_FIELD_MAP, rules: RULES });
    expect(run("5000", "")).toEqual({ package: "0", due: "" });
    expect(run("0", "9999")).toEqual({ advance: "9999", package: "3000", due: "0.00" });
    expect(run("3000", "")).toEqual({ package: "0", due: "" });
    expect(run("", "")).toEqual({ package: "3000", due: "3,000.00" });
  });

  it("reads rates typed with Indian digit grouping", () => {
    const lines = [{ category: "Standee", size: "", qty: "2", rate: "1,250.50" }];
    expect(computeLineItemsPackage(repeatable(lines), ratesOf(lines), layout, JOB_FORM_FIELD_MAP, RULES)).toEqual({ hasRates: true, total: 2501 });
  });

  it("counts lines without a category in the shown sum but not in the package", () => {
    const lines = [...LINES.slice(0, 1), { category: "", size: "1 x 1 ft", qty: "1", rate: "100" }];
    expect(sumLineItems(repeatable(lines), ratesOf(lines), layout, JOB_FORM_FIELD_MAP, RULES)).toBe(3100);
    expect(computeLineItemsPackage(repeatable(lines), ratesOf(lines), layout, JOB_FORM_FIELD_MAP, RULES).total).toBe(3000);
  });
});

describe("create: one job per Job Details card, then Job Details and the invoice", () => {
  const installments: Installment[] = [{ amount: "1000", date: "2026-10-23", paymentMode: "Cash" }];
  const splits = splitIntoJobs({ layout, fieldMap: JOB_FORM_FIELD_MAP, repeatableData: repeatable(LINES), financialRates: ratesOf(LINES), installments, discount: 54.5, fallbackPackage: 0, rules: RULES });
  // Mirrors useJobFormSubmit's create path.
  const saved = splits.map((j) => {
    const data: Record<string, unknown> = { ...baseValues, ...j.globals, package: String(j.packageAmount), category: j.entry.category, fld_b_discount: String(Math.max(0, j.lineTotal - j.packageAmount)) };
    const fd = buildJobFormData({ data, repeatableData: { [SEC]: [j.entry] }, financialRates: j.financialRates, installments: j.installments, layout, fieldMap: JOB_FORM_FIELD_MAP, rules: RULES });
    return saveLikeServer(fd, `job${j.index}`);
  });

  it("gives each job its own line total and shares the discount and advance to the paisa", () => {
    expect(splits.map((s) => s.lineTotal)).toEqual(EXPECTED_LINES);
    const packages = saved.map((s) => s.order.package);
    expect(Math.round(packages.reduce((a, b) => a + b, 0) * 100)).toBe(Math.round((SUM - 54.5) * 100));
    const advance = saved.flatMap((s) => s.installments).reduce((a, i) => a + Number(i.amount), 0);
    expect(round2(advance)).toBe(1000);
    for (const s of saved) expect(s.order.package).toBeGreaterThanOrEqual(0);
  });

  it("stores how every line was priced", () => {
    expect(saved.map((s) => JSON.parse(s.customData.fld_financial_units as string))).toEqual([
      { [`${SEC}_0`]: "sqft" }, { [`${SEC}_0`]: "sqin" }, { [`${SEC}_0`]: "sqcm" }, { [`${SEC}_0`]: "piece" }, { [`${SEC}_0`]: "sqm" },
    ]);
  });

  it("shows the same line totals, areas and rate labels on Job Details", () => {
    const details = saved.map((s) => detailsOf(s, RULES)[0]);
    expect(details.map((d) => d.total)).toEqual(EXPECTED_LINES);
    expect(details.map((d) => d.area)).toEqual([60, 7, 7200, null, 6]);
    expect(details.map((d) => d.rateLabel)).toEqual(["₹ 25 / ft²", "₹ 0.5 / in²", "₹ 0.02 / cm²", "₹ 450", "₹ 400 / m²"]);
    expect(details.every((d) => !d.repricedSince)).toBe(true);
  });

  it("prints invoices whose sub total, discount, total and balance match each job", () => {
    saved.forEach((s, i) => {
      const paid = s.installments.map((x) => Number(x.amount));
      const inv = invoiceOf(s, RULES, paid);
      const discount = round2(EXPECTED_LINES[i] - s.order.package);
      expect(inv.summary.find((r) => r.label === "SUB TOTAL")?.value).toBe(rs(EXPECTED_LINES[i]));
      expect(inv.summary.find((r) => r.label === "DISCOUNT")?.value).toBe(rs(discount));
      expect(inv.total).toBe(rs(s.order.package));
      expect(inv.balance).toBe(rs(round2(s.order.package - paid.reduce((a, b) => a + b, 0))));
      expect(inv.items[0].amount).toBe(rs(EXPECTED_LINES[i]).replace("Rs ", ""));
    });
    expect(invoiceOf(saved[1], RULES).items[0].size).toBe("3.5 x 2 in (7 in²)");
    expect(invoiceOf(saved[2], RULES).items[0].size).toBe("120 x 60 cm (7,200 cm²)");
  });

  it("adds GST on the discounted amount, split equally into CGST and SGST", () => {
    const inv = invoiceOf(saved[0], RULES, [], { business_gst_rate: "18" });
    const half = round2((saved[0].order.package * 18) / 200);
    expect(inv.summary.find((r) => r.label === "CGST (9%)")?.value).toBe(rs(half));
    expect(inv.summary.find((r) => r.label === "SGST (9%)")?.value).toBe(rs(half));
    expect(inv.total).toBe(rs(round2(saved[0].order.package + half * 2)));
  });

  it("keeps saved jobs at the price they were saved with when Settings → Pricing changes", () => {
    const changed: PricingRules = { ...RULES, "Flex Printing": { unit: "piece", defaultRate: 100 }, "Vinyl Printing": { unit: "sqcm", defaultRate: 9 } };
    const flex = detailsOf(saved[0], changed)[0];
    expect(flex).toMatchObject({ total: 3000, unit: "sqft", currentUnit: "piece", repricedSince: true });
    const vinyl = detailsOf(saved[1], changed)[0];
    expect(vinyl).toMatchObject({ total: 10.5, unit: "sqin", currentUnit: "sqcm", repricedSince: true });
    expect(invoiceOf(saved[0], changed).total).toBe(rs(saved[0].order.package));
    expect(invoiceOf(saved[1], changed).total).toBe(rs(saved[1].order.package));
  });
});

describe("edit: one job holding several lines", () => {
  const values = { ...baseValues, package: "" };
  const totals = computeJobTotals({ values, installments: [], repeatableData: repeatable(LINES), financialRates: ratesOf(LINES), layout, fieldMap: JOB_FORM_FIELD_MAP, rules: RULES });
  const fd = buildJobFormData({ data: { ...values, package: totals.package }, repeatableData: repeatable(LINES), financialRates: ratesOf(LINES), installments: [], layout, fieldMap: JOB_FORM_FIELD_MAP, rules: RULES });
  const saved = saveLikeServer(fd, "multi");

  it("saves the form's package and every line's unit", () => {
    expect(saved.order.package).toBe(6400);
    expect(JSON.parse(saved.customData.fld_financial_units as string)).toEqual({ [`${SEC}_0`]: "sqft", [`${SEC}_1`]: "sqin", [`${SEC}_2`]: "sqcm", [`${SEC}_3`]: "piece", [`${SEC}_4`]: "sqm" });
  });

  it("lists every line on Job Details and the invoice, adding up to the package plus the discount", () => {
    expect(detailsOf(saved, RULES).map((d) => d.total)).toEqual(EXPECTED_LINES);
    const inv = invoiceOf(saved, RULES);
    expect(inv.items.map((i) => i.amount)).toEqual(EXPECTED_LINES.map((n) => rs(n).replace("Rs ", "")));
    expect(inv.summary[0]).toEqual({ label: "SUB TOTAL", value: rs(SUM) });
    expect(inv.total).toBe(rs(6400));
  });
});

describe("jobs saved before area units existed", () => {
  it("stay priced per piece when no unit was stored, even if the category is now per area", () => {
    const fd = buildJobFormData({ data: { ...baseValues, fld_b_discount: "", package: "50" }, repeatableData: repeatable([{ category: "Flex Printing", size: "10 x 6 ft", qty: "2", rate: "25" }]), financialRates: ratesOf([{ category: "", size: "", qty: "", rate: "25" }]), installments: [], layout, fieldMap: JOB_FORM_FIELD_MAP, rules: {} });
    const saved = saveLikeServer(fd, "old");
    delete saved.customData.fld_financial_units;
    expect(detailsOf(saved, RULES)[0]).toMatchObject({ total: 50, unit: "piece", currentUnit: "sqft", repricedSince: true });
    expect(invoiceOf(saved, RULES).total).toBe(rs(50));
  });

  it("ignore a stored unit the app doesn't know", () => {
    const fd = buildJobFormData({ data: { ...baseValues, fld_b_discount: "", package: "50" }, repeatableData: repeatable([{ category: "Standee", size: "", qty: "2", rate: "25" }]), financialRates: { [`${SEC}_0`]: "25" }, installments: [], layout, fieldMap: JOB_FORM_FIELD_MAP, rules: RULES });
    const saved = saveLikeServer(fd, "odd");
    saved.customData.fld_financial_units = JSON.stringify({ [`${SEC}_0`]: "sqkm" });
    expect(detailsOf(saved, RULES)[0]).toMatchObject({ total: 50, unit: "piece" });
  });
});

describe("splitting money across jobs (2,000 random forms)", () => {
  let seed = 424242;
  const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  it("never loses or invents a paisa", () => {
    for (let n = 0; n < 2_000; n++) {
      const count = 1 + Math.floor(rand() * 6);
      const weights = Array.from({ length: count }, () => (rand() < 0.15 ? 0 : Math.round(rand() * 1_000_000) / 100));
      const total = Math.round(rand() * 500_000) / 100;
      const shares = splitProportionally(total, weights);
      expect(shares.length).toBe(count);
      expect(Math.round(shares.reduce((a, b) => a + b, 0) * 100)).toBe(Math.round(total * 100));
      for (const s of shares) expect(Math.round(s * 100)).toBe(s * 100 === Math.round(s * 100) ? s * 100 : Math.round(s * 100));
      if (weights.some((w) => w > 0)) weights.forEach((w, i) => { if (w === 0 && i !== count - 1) expect(shares[i]).toBe(0); });
    }
  });

  it("keeps Σ packages = Σ line totals − discount and Σ advances = the advance", () => {
    const categories = Object.keys(RULES);
    for (let n = 0; n < 500; n++) {
      const lines: Line[] = Array.from({ length: 1 + Math.floor(rand() * 5) }, () => ({
        category: categories[Math.floor(rand() * categories.length)],
        size: `${1 + Math.floor(rand() * 40)} x ${1 + Math.floor(rand() * 40)} ${["ft", "in", "cm", "m"][Math.floor(rand() * 4)]}`,
        qty: String(1 + Math.floor(rand() * 20)),
        rate: String(Math.round(rand() * 50000) / 100),
      }));
      const sum = lines.reduce((a, l, i) => a + round2(computeLineItemsPackage(repeatable([l]), { [`${SEC}_0`]: ratesOf(lines)[`${SEC}_${i}`] }, layout, JOB_FORM_FIELD_MAP, RULES).total), 0);
      const discount = round2(rand() * sum * 0.3);
      const advance = round2(rand() * (sum - discount));
      const splits = splitIntoJobs({ layout, fieldMap: JOB_FORM_FIELD_MAP, repeatableData: repeatable(lines), financialRates: ratesOf(lines), installments: [{ amount: String(advance), date: "", paymentMode: "Cash" }], discount, fallbackPackage: 0, rules: RULES });
      expect(Math.round(splits.reduce((a, s) => a + s.packageAmount, 0) * 100)).toBe(Math.round((sum - discount) * 100));
      expect(Math.round(splits.flatMap((s) => s.installments).reduce((a, i) => a + Number(i.amount), 0) * 100)).toBe(Math.round(advance * 100));
    }
  });
});

// Quantity is a free-text field: digit grouping, negatives and zero must never mis-bill.
describe("quantities", () => {
  const one = (qty: string, rate = "2") => computeLineItemsPackage(repeatable([{ category: "Standee", size: "", qty, rate }]), { [`${SEC}_0`]: rate }, layout, JOB_FORM_FIELD_MAP, RULES).total;
  const area = (qty: string) => computeLineItemsPackage(repeatable([{ category: "Flex Printing", size: "10 x 6 ft", qty, rate: "25" }]), { [`${SEC}_0`]: "25" }, layout, JOB_FORM_FIELD_MAP, RULES).total;
  it("reads digit grouping: 1,000 cards at ₹2 is ₹2,000 and 1,00,000 is a lakh", () => {
    expect(one("1,000")).toBe(2000);
    expect(one("1,00,000")).toBe(200000);
    expect(one(" 1 000 ")).toBe(2000);
    expect(area("1,000")).toBe(1_500_000);
  });
  it("never prices a negative quantity below zero", () => {
    expect(one("-5")).toBe(0);
    expect(area("-2")).toBe(0);
  });
  it("charges nothing for a zero quantity and one piece when it's left empty", () => {
    expect(one("0")).toBe(0);
    expect(one("0.0")).toBe(0);
    expect(one("")).toBe(2);
    expect(one("   ")).toBe(2);
  });
  it("reads decimals and a number followed by a word", () => {
    expect(one("2.5")).toBe(5);
    expect(one(".5")).toBe(1);
    expect(one("3 pcs")).toBe(6);
    expect(one("abc")).toBe(2);
  });
});
