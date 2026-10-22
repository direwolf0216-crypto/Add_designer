import { describe, expect, it } from "vitest";
import { JOB_FORM_FIELD_MAP } from "@/lib/forms/fieldMap";
import { isVisibleIn } from "@/lib/forms/visibility";
import type { FormLayout } from "@/lib/forms/types";
import {
  buildJobFormData,
  emptyRepeatableSections,
  jobToFormState,
  layoutDefaults,
  missingMandatoryFields,
  newRepeatableEntry,
  parseCustomData,
  prepareFileValues,
  removeRepeatableEntry,
  shiftRatesAfterRemoval,
  sortFinancialFields,
  withoutHiddenFields,
} from "../formMapping";

const map = JOB_FORM_FIELD_MAP;
const layout: FormLayout = {
  sections: [
    {
      id: "sec_job_basic",
      fields: [
        { id: "fld_b_client", name: "Client", type: "SINGLE_LINE", mandatory: true },
        { id: "fld_b_phone", name: "Phone", type: "PHONE", mandatory: true },
      ],
    },
    {
      id: "sec_job_event",
      fields: [
        { id: "fld_b_date", name: "Order Date", type: "DATE", isRecordDate: true },
        { id: "fld_b_job_status", name: "Job Status", type: "STATUS_PICKER", statusOptions: [{ label: "Pending" }, { label: "Done" }] },
        { id: "fld_b_job_category", name: "Job Category", type: "PICK_LIST", options: ["Flex", "Posters"] },
        { id: "fld_mode", name: "Mode", type: "PICK_LIST", options: [{ label: "Cash", value: "cash" }], defaultValue: "UPI" },
        { id: "fld_note", name: "Note", type: "MULTI_LINE", mandatory: true, visibilityRule: { fieldId: "fld_b_job_category", operator: "EQUALS", value: "Posters" } },
      ],
    },
    {
      id: "items",
      title: "Items",
      isRepeatable: true,
      fields: [
        { id: "fld_item_cat", name: "Category", type: "CATEGORY_PICKER", options: ["A", "B"] },
        { id: "fld_item_qty", name: "Qty", type: "NUMBER", defaultValue: "1" },
      ],
    },
  ],
};

describe("parseCustomData", () => {
  it("accepts JSON strings and objects", () => {
    expect(parseCustomData('{"a":1}')).toEqual({ a: 1 });
    expect(parseCustomData("not json")).toEqual({});
    expect(parseCustomData({ b: 2 })).toEqual({ b: 2 });
    expect(parseCustomData(null)).toEqual({});
  });
});

describe("jobToFormState", () => {
  const job = {
    id: "j1",
    title: "Legacy title",
    client: { name: "Rahul", phone: "999", email: "" },
    date: "2026-03-04T00:00:00.000Z",
    status: "Printing",
    category: "Flex",
    order: { package: 1200, advance: 0 },
    customData: {
      fld_b_time: "11:00 AM",
      fld_b_email: "r@x.com",
      fld_custom: "x",
      rep_items: '[{"fld_item_cat":"A"}]',
      fld_financial_rates: '{"rep_items_0":"100"}',
    },
    transactions: [
      { id: "t2", amount: 300, date: "2026-03-06T10:00:00", type: "INCOME", category: "JOB", paymentMode: "UPI" },
      { id: "t1", amount: 200, date: "2026-03-05T10:00:00", type: "INCOME", category: "JOB", paymentMode: null },
      { id: "t3", amount: 50, date: "2026-03-05T10:00:00", type: "EXPENSE", category: "JOB" },
      { id: "t4", amount: 70, date: "2026-03-05T10:00:00", type: "INCOME", category: "JOB", deletedAt: "2026-03-07" },
    ],
  };

  it("maps columns, customData, repeatable entries and rates", () => {
    const state = jobToFormState(job, "2026-01-01");
    expect(state.values).toMatchObject({
      id: "j1", title: "Rahul", phone: "999", email: "r@x.com", date: "2026-03-04", time: "11:00 AM",
      category: "Flex", status: "Printing", package: "1200", advance: "", due: "", fld_custom: "x",
    });
    expect(state.values.rep_items).toBeUndefined();
    expect(state.repeatableData).toEqual({ rep_items: [{ fld_item_cat: "A" }] });
    expect(state.financialRates).toEqual({ rep_items_0: "100" });
    // Source job is not mutated.
    expect(job.customData.rep_items).toBeDefined();
  });

  it("uses the job's own INCOME payments as installments, oldest first", () => {
    const state = jobToFormState(job, "2026-01-01");
    expect(state.isMultiInstallment).toBe(true);
    expect(state.installments).toEqual([
      { amount: "200", date: "2026-03-05", paymentMode: "Cash", transactionId: "t1" },
      { amount: "300", date: "2026-03-06", paymentMode: "UPI", transactionId: "t2" },
    ]);
  });

  it("falls back to order installments, then to a single advance installment", () => {
    const orderInst = [{ amount: "5", date: "2026-01-02", paymentMode: "Cash" }];
    expect(jobToFormState({ id: "j", order: { installments: orderInst } }).installments).toBe(orderInst);
    const single = jobToFormState({ id: "j", order: { advance: 400 }, customData: { paymentMode: "UPI" } }, "2026-02-02");
    expect(single.isMultiInstallment).toBe(false);
    expect(single.installments).toEqual([{ amount: "400", date: "2026-02-02", paymentMode: "UPI" }]);
  });

  it("keeps the current rates when stored rates are unparseable, clears them when absent", () => {
    expect(jobToFormState({ id: "j", customData: { fld_financial_rates: "{bad" } }).financialRates).toBeUndefined();
    expect(jobToFormState({ id: "j", customData: {} }).financialRates).toEqual({});
  });
});

describe("layoutDefaults", () => {
  it("builds create-mode defaults", () => {
    const { values, repeatableData } = layoutDefaults(layout, map, "2026-05-01");
    expect(values).toMatchObject({ date: "2026-05-01", time: "10:00 AM", status: "Pending", category: "Flex", fld_mode: "UPI" });
    expect(values.fld_item_cat).toBeUndefined();
    expect(repeatableData).toEqual({ rep_items: [{ fld_item_cat: "A", fld_item_qty: "1" }] });
  });

  it("works before the layout loads", () => {
    expect(layoutDefaults(null, map, "2026-05-01")).toEqual({
      values: { title: "", category: "", date: "2026-05-01", time: "10:00 AM", location: "", phone: "", email: "", package: "", advance: "", due: "", status: "Confirmed" },
      repeatableData: {},
    });
  });

  it("new repeatable entries start from the first option or default", () => {
    expect(newRepeatableEntry(layout.sections[2], map)).toEqual({ fld_item_cat: "A", fld_item_qty: "1" });
  });
});

describe("repeatable entry removal", () => {
  it("removes the entry and shifts later rates down", () => {
    expect(removeRepeatableEntry({ rep_x: [{ a: 1 }, { a: 2 }, { a: 3 }] }, "rep_x", 1)).toEqual({ rep_x: [{ a: 1 }, { a: 3 }] });
    expect(shiftRatesAfterRemoval({ rep_x_0: "10", rep_x_1: "20", rep_x_2: "30", rep_y_0: "5" }, "rep_x", 1, 3)).toEqual({ rep_x_0: "10", rep_x_1: "30", rep_y_0: "5" });
    expect(shiftRatesAfterRemoval({ rep_x_0: "10", rep_x_2: "30" }, "rep_x", 0, 3)).toEqual({ rep_x_1: "30" });
  });
});

describe("validation and payload", () => {
  const isVisible = (values: Record<string, unknown>) => (rule: Parameters<typeof isVisibleIn>[0]) => isVisibleIn(rule, values, map);

  it("finds empty repeatable sections and missing visible mandatory fields", () => {
    expect(emptyRepeatableSections(layout, { rep_items: [] }).map((s) => s.id)).toEqual(["items"]);
    expect(emptyRepeatableSections(layout, { rep_items: [{}] })).toEqual([]);

    const data = { title: "", phone: "1", category: "Flex" };
    expect(missingMandatoryFields(layout, data, isVisible(data), map)).toEqual([{ fieldName: "title", message: "Client is required" }]);
    const posters = { title: "x", phone: [], category: "Posters" };
    expect(missingMandatoryFields(layout, posters, isVisible(posters), map).map((m) => m.fieldName)).toEqual(["phone", "fld_note"]);
  });

  it("drops hidden fields", () => {
    const data = { title: "x", category: "Flex", fld_note: "secret" };
    expect(withoutHiddenFields(data, layout, isVisible(data), map)).toEqual({ title: "x", category: "Flex" });
  });

  it("normalises file values and collects uploads", () => {
    const file = new File(["x"], "a.png");
    const { data, uploads } = prepareFileValues({ photo: [file], doc: [{ driveFile: { id: "d" } }], meta: { a: 1 }, list: ["a", "b"], s: "x" });
    expect(uploads).toEqual([{ key: "photo", file }]);
    expect(data).toEqual({ photo: file, doc: '{"driveFile":{"id":"d"}}', meta: '{"a":1}', list: ["a", "b"], s: "x" });
  });

  it("builds the saveJobAction FormData", () => {
    const fd = buildJobFormData({
      data: { title: "Rahul", date: "2026-05-01", tags: ["a", "b"], obj: { k: 1 }, empty: undefined, nil: null, flag: true, installments: "stale" },
      repeatableData: { rep_items: [{ fld_item_cat: "A" }] },
      financialRates: { rep_items_0: "100" },
      installments: [
        { amount: "100", date: "2026-05-01", paymentMode: "Cash" },
        { amount: "", date: "2026-05-01", paymentMode: "Cash" },
      ],
      layout,
      fieldMap: map,
    });
    expect([...fd.entries()]).toEqual([
      ["title", "Rahul"],
      ["date", "2026-05-01"],
      ["tags", "a, b"],
      ["obj", '{"k":1}'],
      ["flag", "true"],
      ["installments", '[{"amount":"100","date":"2026-05-01","paymentMode":"Cash"}]'],
      ["rep_items", '[{"fld_item_cat":"A"}]'],
      ["fld_financial_rates", '{"rep_items_0":"100"}'],
      ["fld_financial_units", '{"rep_items_0":"piece"}'],
      ["recordDate", "2026-05-01"],
    ]);
  });
});

describe("sortFinancialFields", () => {
  const f = (id: string, name: string) => ({ id, name, type: "CURRENCY" });
  it("orders package, discount, advance (and optionally payment) first, stable otherwise", () => {
    const fields = [f("x", "Notes"), f("fld_b_advance", "Advance"), f("p", "Payment Mode"), f("d", "Discount"), f("fld_b_package", "Amount")];
    expect(sortFinancialFields(fields, map, false).map((x) => x.id)).toEqual(["fld_b_package", "d", "fld_b_advance", "x", "p"]);
    expect(sortFinancialFields(fields, map, true).map((x) => x.id)).toEqual(["fld_b_package", "d", "fld_b_advance", "p", "x"]);
  });
});
