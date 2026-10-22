import { describe, expect, it } from "vitest";
import { JOB_DETAILS_FIELD_MAP } from "@/lib/forms/fieldMap";
import { evaluateVisibility } from "@/lib/forms/visibility";
import type { FormLayout } from "@/lib/forms/types";
import {
  buildStatusSteps,
  dynamicFieldValue,
  getDynamicFieldValue,
  jobValueLookup,
  normalizeJob,
  resolveDynamicSections,
  resolveFinancials,
  resolveJobSummary,
  resolveSpecEntries,
} from "../resolveJobFields";

const map = JOB_DETAILS_FIELD_MAP;
const layout: FormLayout = {
  sections: [
    { id: "sec_basic", title: "Client Info", fields: [{ id: "fld_b_client", name: "Client", type: "SINGLE_LINE" }, { id: "fld_ref", name: "Reference", type: "SINGLE_LINE" }] },
    {
      id: "jd",
      title: "Job Details",
      isRepeatable: true,
      fields: [
        { id: "fld_cat", name: "Category", type: "PICK_LIST" },
        { id: "fld_size", name: "Size", type: "SINGLE_LINE" },
        { id: "fld_qty", name: "Qty", type: "NUMBER" },
      ],
    },
    {
      id: "fin",
      title: "Financials",
      fields: [{ id: "fld_b_package", name: "Total", type: "CURRENCY" }],
    },
    {
      id: "finish",
      title: "Finishing",
      isRepeatable: true,
      fields: [
        { id: "fld_paper", name: "Paper", type: "SINGLE_LINE", isRepeatableField: false },
        { id: "fld_lam", name: "Lamination", type: "SINGLE_LINE" },
        { id: "fld_file", name: "Artwork", type: "FILE" },
        { id: "fld_due", name: "Due Date", type: "DATE" },
      ],
    },
    { id: "status", title: "Tracking", fields: [{ id: "fld_b_status", name: "Status", type: "STATUS_PICKER", statusOptions: [{ label: "Pending" }, { label: "Designing" }, { label: "Printing" }, { label: "Delivered" }, { label: "Cancelled" }, { label: "Done" }, { label: "Other" }] }] },
  ],
};

const job = normalizeJob({
  id: "abcdef123456",
  status: "Designing",
  createdAt: "2026-05-01T10:00:00Z",
  order: { package: 1500, advance: 500 },
  customData: JSON.stringify({
    fld_ref: "R-1",
    fld_paper: "Art",
    fld_financial_rates: '{"rep_jd_0":"100"}',
    rep_jd: [
      { fld_cat: "Flex", fld_size: "10x4", fld_qty: "3" },
      { fld_cat: "Posters", fld_qty: "2", rate: "₹ 50" },
    ],
    rep_finish: '[{"fld_lam":"Gloss"},{"fld_lam":""}]',
  }),
  inclusions: "[1]",
});

describe("normalizeJob", () => {
  it("parses JSON columns", () => {
    expect(job.customData.fld_ref).toBe("R-1");
    expect(job.inclusions).toEqual([1]);
    expect(normalizeJob({ id: "x", customData: "{bad", inclusions: "{bad" })).toMatchObject({ customData: {}, inclusions: [] });
  });
});

describe("getDynamicFieldValue", () => {
  it("reads customData, the standard key, then the first repeatable entry", () => {
    expect(getDynamicFieldValue({ a: 1 }, "a")).toBe(1);
    expect(getDynamicFieldValue({ category: "C" }, "fld_x", "category")).toBe("C");
    expect(getDynamicFieldValue({ rep_s: '[{"fld_x":"from rep"}]' }, "fld_x")).toBe("from rep");
    expect(getDynamicFieldValue(null, "a")).toBeNull();
  });
});

describe("resolveJobSummary", () => {
  it("collects categories of repeatable line items and reads size/qty from the first entry", () => {
    expect(resolveJobSummary(job, layout, map)).toEqual({ sizeVal: "10x4", qtyVal: "3", dueDateVal: null, displayCategory: "Flex, Posters" });
  });

  it("parses JSON-array categories and defaults to N/A", () => {
    const j = normalizeJob({ id: "x", category: '["A","B"]', customData: {} });
    expect(resolveJobSummary(j, null, map).displayCategory).toBe("A, B");
    expect(resolveJobSummary(normalizeJob({ id: "x", customData: {} }), null, map).displayCategory).toBe("N/A");
  });
});

describe("resolveFinancials", () => {
  it("uses the order, then customData", () => {
    expect(resolveFinancials(job)).toEqual({ totalAmount: 1500, advanceAmount: 500, dueAmount: 1000, paymentMethod: "Cash" });
    expect(resolveFinancials(normalizeJob({ id: "x", customData: { fld_b_package: "200", fld_b_payment_mode: "UPI" } }))).toEqual({
      totalAmount: 200, advanceAmount: 0, dueAmount: 200, paymentMethod: "UPI",
    });
  });
});

describe("resolveSpecEntries", () => {
  it("lists repeatable line items with rates from fld_financial_rates or the entry", () => {
    const summary = resolveJobSummary(job, layout, map);
    expect(resolveSpecEntries(job, layout, map, summary)).toEqual([
      { category: "Flex", size: "10x4", quantity: "3", rateLabel: "₹ 100", total: 300, unit: "piece", area: null, repricedSince: false },
      { category: "Posters", size: "10x4", quantity: "2", rateLabel: "₹ 50", total: null, unit: "piece", area: null, repricedSince: false },
    ]);
  });

  it("falls back to the job itself without a job-details section", () => {
    const j = normalizeJob({ id: "x", customData: { fld_print_size: "A4", fld_print_quantity: "10", rate: "5" } });
    expect(resolveSpecEntries(j, null, map, resolveJobSummary(j, null, map))).toEqual([
      { category: undefined, size: "A4", quantity: "10", rateLabel: "₹ 5", total: 50, unit: "piece", area: null, repricedSince: false },
    ]);
  });
});

describe("resolveDynamicSections", () => {
  it("skips fixed sections and hidden fields; splits repeatable fields", () => {
    const sections = resolveDynamicSections(job, layout);
    expect(sections.map((s) => s.section.id)).toEqual(["sec_basic", "finish"]);
    expect(sections[0].globalFields.map((f) => f.id)).toEqual(["fld_ref"]);
    expect(sections[1].globalFields.map((f) => f.id)).toEqual(["fld_paper"]);
    expect(sections[1].itemFields.map((f) => f.id)).toEqual(["fld_lam"]);
    expect(sections[1].entries).toHaveLength(2);
  });

  it("resolves values from job columns when mapped", () => {
    const client = { id: "fld_b_client", name: "Client", type: "SINGLE_LINE" };
    expect(dynamicFieldValue({ ...job, title: "T" }, client, map, job.customData)).toBe("T");
    expect(dynamicFieldValue(job, { id: "fld_ref", name: "Ref", type: "X" }, map, job.customData)).toBe("R-1");
  });
});

describe("jobValueLookup", () => {
  it("evaluates visibility against job columns, then customData", () => {
    expect(evaluateVisibility({ fieldId: "fld_b_status", operator: "EQUALS", value: "Designing" }, jobValueLookup(job), map)).toBe(true);
    expect(evaluateVisibility({ fieldId: "fld_ref", operator: "EQUALS", value: "R-1" }, jobValueLookup(job), map)).toBe(true);
  });
});

describe("buildStatusSteps", () => {
  it("guesses icons/colours from labels", () => {
    expect(buildStatusSteps(layout).map((s) => s.color)).toEqual([
      "text-amber-500", "text-blue-500", "text-fuchsia-500", "text-green-500", "text-red-500", "text-emerald-500", "text-slate-500",
    ]);
  });

  it("has defaults without a status picker", () => {
    expect(buildStatusSteps(null).map((s) => s.value)).toEqual(["Pending", "Designing", "Designing Completed", "Sent for printing", "Ready for delivery"]);
  });
});
