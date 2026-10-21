import { describe, expect, it } from "vitest";
import {
  formatJobOrderDate,
  getDetailStatusStyle,
  getRowStatusStyle,
  jobDisplayNumber,
  overdueDays,
  resolveJobRowFields,
} from "../statusRow";

describe("formatJobOrderDate / jobDisplayNumber", () => {
  it("formats the date part, or '-'", () => {
    expect(formatJobOrderDate("2026-03-05T10:00:00.000Z")).toBe("05 Mar 2026");
    expect(formatJobOrderDate(null)).toBe("-");
  });

  it("falls back to a BK- reference from the id", () => {
    expect(jobDisplayNumber({ id: "clxyzab12", jobNumber: "JB-7" })).toBe("JB-7");
    expect(jobDisplayNumber({ id: "clxyzab12", jobNumber: null })).toBe("BK-AB12");
  });
});

describe("resolveJobRowFields", () => {
  it("prefers well-known keys", () => {
    const r = resolveJobRowFields(
      { id: "1", category: "Job cat" },
      { due_date: "2026-11-02", category: "Flex", size: "A3", qty: "100" },
      null,
    );
    expect(r).toEqual({ deliveryDateStr: "2026-11-02", formattedDeliveryDate: "02 Nov 2026", category: "Flex", size: "A3", qty: "100" });
  });

  it("uses layout field names, skipping the record date", () => {
    const schema = {
      sections: [
        {
          fields: [
            { id: "f_rec", name: "Order Date", isRecordDate: true },
            { id: "f_cat", name: "Job Category" },
            { id: "f_when", name: "Delivery On" },
            { id: "f_sz", name: "Print Size" },
            { id: "f_q", name: "Quantity" },
          ],
        },
      ],
    };
    const r = resolveJobRowFields({ id: "1" }, { f_rec: "2026-01-01", f_cat: "Visiting cards", f_when: "2026-12-25", f_sz: "A4", f_q: "500" }, schema);
    expect(r).toMatchObject({ deliveryDateStr: "2026-12-25", category: "Visiting cards", size: "A4", qty: "500" });
  });

  it("falls back to any matching customData key, then the first line item, then job.category", () => {
    const r = resolveJobRowFields(
      { id: "1", category: "Fallback", items: [{ paper_size: "A5", item_qty: "20" }] },
      { custom_delivery_on: "2026-10-10" },
      undefined,
    );
    expect(r).toEqual({ deliveryDateStr: "2026-10-10", formattedDeliveryDate: "10 Oct 2026", category: "Fallback", size: "A5", qty: "20" });
  });

  it("reports missing values", () => {
    expect(resolveJobRowFields({ id: "1" }, {}, null)).toEqual({
      deliveryDateStr: undefined,
      formattedDeliveryDate: "Not set",
      category: "-",
      size: null,
      qty: null,
    });
  });
});

describe("overdueDays", () => {
  const now = new Date("2026-10-20T12:00:00Z");
  it("counts whole days past due for undelivered jobs", () => {
    expect(overdueDays("2026-10-17T12:00:00Z", "Printing", now)).toBe(3);
    expect(overdueDays("2026-10-17T12:00:00Z", "Delivered", now)).toBeNull();
    expect(overdueDays("2026-10-25", "Printing", now)).toBeNull();
    expect(overdueDays(undefined, "Printing", now)).toBeNull();
    expect(overdueDays("soon", "Printing", now)).toBeNull();
  });
});

describe("status styles", () => {
  it("row pill classes per status (case-insensitive, 'ready' alias)", () => {
    expect(getRowStatusStyle("Pending")).toEqual({ bg: "bg-orange-100", text: "text-slate-800", dot: "bg-orange-500" });
    expect(getRowStatusStyle("READY")).toEqual({ bg: "bg-emerald-100", text: "text-slate-800", dot: "bg-emerald-500" });
    expect(getRowStatusStyle("On hold")).toEqual({ bg: "bg-slate-100", text: "text-slate-700", dot: "bg-slate-400" });
  });

  it("detail badge + default progress per stage, keeping an explicit job_progress", () => {
    expect(getDetailStatusStyle("Pending", undefined)).toEqual({ color: "bg-slate-100 text-slate-700", progress: 0 });
    expect(getDetailStatusStyle("Designing", "0")).toEqual({ color: "bg-orange-100 text-orange-700", progress: 25 });
    expect(getDetailStatusStyle("Printing", "60")).toEqual({ color: "bg-purple-100 text-purple-700", progress: 60 });
    expect(getDetailStatusStyle("Delivered", "")).toEqual({ color: "bg-blue-100 text-blue-700", progress: 100 });
  });
});
