import { describe, expect, it } from "vitest";
import type { FormLayout } from "@/lib/forms/types";
import { keepStoredMoney, layoutWithoutMoney, moneyKeys, withoutMoney } from "../amounts";

const layout = {
  sections: [
    { id: "sec_job_details", title: "Details", fields: [{ id: "fld_paper", name: "Paper", type: "SINGLE_LINE" }, { id: "fld_extra_fee", name: "Rush fee", type: "CURRENCY" }] },
    { id: "rep_items", title: "Items", isRepeatable: true, fields: [{ id: "fld_item", name: "Item", type: "SINGLE_LINE" }, { id: "fld_item_price", name: "Price", type: "CURRENCY" }] },
    { id: "sec_job_financial", title: "Financials", fields: [{ id: "fld_b_package", name: "Total", type: "CURRENCY" }, { id: "fld_discount", name: "Discount", type: "NUMBER" }] },
  ],
} as unknown as FormLayout;

describe("job amounts", () => {
  const keys = moneyKeys(layout);

  it("treats the Financials section, currency fields and rates as money", () => {
    expect([...keys].sort()).toEqual(["fld_b_package", "fld_discount", "fld_extra_fee", "fld_financial_rates", "fld_item_price", "package"].sort());
  });

  it("strips money values, including inside repeatable entries", () => {
    const data = { fld_paper: "Art", fld_extra_fee: "500", fld_financial_rates: '{"rep_items_0":"20"}', rep_items: JSON.stringify([{ fld_item: "Card", fld_item_price: "20" }]) };
    expect(withoutMoney(data, keys)).toEqual({ fld_paper: "Art", rep_items: JSON.stringify([{ fld_item: "Card" }]) });
  });

  it("keeps the stored money when someone without amounts saves", () => {
    const stored = { fld_paper: "Art", fld_extra_fee: "500", fld_financial_rates: "{}", rep_items: [{ fld_item: "Card", fld_item_price: "20" }] };
    // A crafted request trying to change the fee and price is ignored; other edits apply.
    const incoming = { fld_paper: "Matte", fld_extra_fee: "0", rep_items: [{ fld_item: "Card v2", fld_item_price: "1" }] };
    expect(keepStoredMoney(incoming, stored, keys)).toEqual({
      fld_paper: "Matte",
      fld_extra_fee: "500",
      fld_financial_rates: "{}",
      rep_items: [{ fld_item: "Card v2", fld_item_price: "20" }],
    });
  });

  it("drops the Financials section and currency fields from the form layout", () => {
    const shown = layoutWithoutMoney(layout)!;
    expect(shown.sections.map((s) => s.id)).toEqual(["sec_job_details", "rep_items"]);
    expect(shown.sections.flatMap((s) => s.fields.map((f) => f.id))).toEqual(["fld_paper", "fld_item"]);
  });
});
