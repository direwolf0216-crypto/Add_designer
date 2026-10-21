import { describe, expect, it } from "vitest";
import { TRANSACTION_FIELD_MAP } from "@/lib/forms/fieldMap";
import type { FormLayout } from "@/lib/forms/types";
import {
  apiFieldErrors,
  buildTransactionRequest,
  categoryAmountsTotal,
  isGroupId,
  perCategoryPayloads,
  selectedCategories,
  successToast,
  toPayload,
  transactionLayoutDefaults,
  transactionToForm,
  validateTransactionForm,
  withRecordDate,
} from "../formMapping";

const map = TRANSACTION_FIELD_MAP;
const layout: FormLayout = {
  sections: [
    {
      id: "sec_tx_details",
      fields: [
        { id: "fld_tx_amount", name: "Amount", type: "CURRENCY", mandatory: true },
        { id: "fld_tx_type", name: "Transaction Type", type: "PICK_LIST", mandatory: true, options: ["INCOME", "EXPENSE"] },
        { id: "fld_tx_date", name: "Date", type: "DATE", mandatory: true, isRecordDate: true },
        { id: "fld_tx_category", name: "Category", type: "PICK_LIST", mandatory: true, options: ["Printing Job", "Rent"] },
        { id: "fld_tx_mode", name: "Payment Mode", type: "PICK_LIST", options: ["Cash", "UPI"] },
        { id: "fld_state", name: "State", type: "STATUS_PICKER", statusOptions: [{ label: "Open" }] },
        { id: "fld_tx_desc", name: "Description", type: "MULTI_LINE" },
      ],
    },
  ],
};

describe("transactionToForm", () => {
  it("maps a record and its per-category items", () => {
    expect(
      transactionToForm({
        id: "grp_1", amount: 300, type: "EXPENSE", date: "2026-05-01T05:30:00.000Z", category: "Rent, Ink",
        paymentMode: "UPI", description: null, status: "SETTLED", customData: { fld_x: "y" },
        items: [{ category: "Rent", amount: 200 }, { category: "Ink", amount: 100 }],
      })
    ).toEqual({
      amount: "300", type: "EXPENSE", date: "2026-05-01T05:30:00.000Z", category: "Rent, Ink", paymentMode: "UPI",
      description: "", status: "SETTLED", fld_x: "y", amount_Rent: "200", amount_Ink: "100",
    });
  });
});

describe("transactionLayoutDefaults", () => {
  it("defaults pick-lists (not category) and statuses; presets win", () => {
    const now = new Date("2026-05-01T00:00:00Z");
    expect(transactionLayoutDefaults(layout, map, {}, now)).toEqual({
      type: "INCOME", status: "SETTLED", date: now.toISOString(), amount: "", category: "", paymentMode: "Cash", fld_state: "Open", description: "",
    });
    expect(transactionLayoutDefaults(layout, map, { type: "EXPENSE", category: "Rent" }, now)).toMatchObject({ type: "EXPENSE", category: "Rent" });
  });
});

describe("validateTransactionForm", () => {
  it("requires mandatory fields and a positive amount", () => {
    expect(validateTransactionForm({ amount: "0", type: "INCOME", date: "d", category: "Rent" }, layout, map)).toEqual({ amount: "Enter a valid positive amount." });
    expect(validateTransactionForm({ type: "INCOME", date: "d", category: "Rent" }, layout, map)).toEqual({ amount: "Amount is required." });
    expect(validateTransactionForm({ amount: "10", type: "INCOME", date: "d", category: "Rent" }, layout, map)).toEqual({});
  });

  it("with several categories, requires each category's amount instead", () => {
    expect(validateTransactionForm({ type: "INCOME", date: "d", category: "Rent, Ink", amount_Rent: "5" }, layout, map)).toEqual({
      amount_Ink: "Required",
      category: "Enter valid amounts for all selected categories.",
    });
  });
});

describe("payloads and requests", () => {
  const form = { amount: "12.5", type: "EXPENSE", date: "2026-05-01T00:00:00.000Z", category: "Rent, Ink", amount_Rent: "10", amount_Ink: "2.5" };

  it("prepares the payload", () => {
    expect(toPayload({ amount: "12.5" })).toEqual({ amount: 12.5 });
    expect(toPayload({ amount: "" })).toEqual({ amount: "" });
    expect(withRecordDate({ date: "D" }, layout, map)).toEqual({ date: "D", recordDate: "D" });
    expect(withRecordDate({}, layout, map)).toEqual({});
    expect(selectedCategories(form.category)).toEqual(["Rent", "Ink"]);
    expect(categoryAmountsTotal(form, ["Rent", "Ink"])).toBe(12.5);
    expect(isGroupId("grp_x")).toBe(true);
    expect(isGroupId("tx_1")).toBe(false);
  });

  it("splits one payload per category", () => {
    expect(perCategoryPayloads(toPayload(form), ["Rent", "Ink"])).toEqual([
      { amount: 10, type: "EXPENSE", date: form.date, category: "Rent" },
      { amount: 2.5, type: "EXPENSE", date: form.date, category: "Ink" },
    ]);
  });

  it("picks the endpoint", () => {
    const payload = toPayload(form);
    expect(buildTransactionRequest(payload, null)).toMatchObject({ url: "/api/transactions/bulk", method: "POST" });
    expect(buildTransactionRequest(payload, { id: "grp_9" })).toMatchObject({ url: "/api/transactions/bulk/grp_9", method: "PUT" });
    expect(buildTransactionRequest(payload, { id: "tx_1" })).toEqual({ url: "/api/transactions/tx_1", method: "PUT", body: payload });
    const single = toPayload({ amount: "5", category: "Rent" });
    expect(buildTransactionRequest(single, null)).toEqual({ url: "/api/transactions", method: "POST", body: single });
  });

  it("formats the success toast and API field errors", () => {
    const date = new Date("2026-05-01T00:00:00.000Z").toLocaleDateString("en-IN");
    expect(successToast(form, 2, false)).toEqual({ title: "Transactions recorded!", description: `Recorded 2 items on ${date}` });
    expect(successToast({ ...form, amount: "1200" }, 1, true)).toEqual({ title: "Transaction updated!", description: `₹1,200.00 expense on ${date}` });
    expect(apiFieldErrors(422, { details: { amount: ["Too big", "x"], date: "Bad" } })).toEqual({ amount: "Too big", date: "Bad" });
    expect(apiFieldErrors(400, { details: { amount: ["x"] } })).toBeNull();
    expect(apiFieldErrors(422, {})).toBeNull();
  });
});
