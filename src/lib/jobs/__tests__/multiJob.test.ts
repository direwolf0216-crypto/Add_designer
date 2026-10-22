import { describe, expect, it } from "vitest";
import { JOB_FORM_FIELD_MAP } from "@/lib/forms/fieldMap";
import type { FormLayout } from "@/lib/forms/types";
import { missingEntryFields, splitIntoJobs, splitProportionally } from "../multiJob";

const layout = {
  sections: [
    {
      id: "sec_job_event", title: "Job Details", isRepeatable: true,
      fields: [
        { id: "fld_b_date", name: "Order Date", type: "DATE", mandatory: true, isRepeatableField: false },
        { id: "f_due", name: "Due date", type: "DATE", mandatory: true, isRepeatableField: false },
        { id: "fld_b_job_category", name: "Job Category", type: "PICK_LIST" },
        { id: "f_size", name: "Size", type: "SINGLE_LINE", mandatory: true },
        { id: "f_qty", name: "Quantity", type: "NUMBER", mandatory: true },
        { id: "fld_b_status", name: "Status", type: "STATUS_PICKER", isRepeatableField: false },
      ],
    },
  ],
} as unknown as FormLayout;

describe("splitProportionally", () => {
  it("splits in paise and keeps the total", () => {
    expect(splitProportionally(100, [1, 2])).toEqual([33.33, 66.67]);
    expect(splitProportionally(500, [0, 0])).toEqual([500, 0]);
  });
});

describe("splitIntoJobs", () => {
  const repeatableData = {
    rep_sec_job_event: [
      { date: "2026-10-22", f_due: "2026-10-25", category: "Flex Printing", f_size: "10 x 6", f_qty: "1" },
      { date: "2026-10-22", f_due: "2026-10-28", category: "Visiting Cards", f_size: "3.5 x 2 in", f_qty: "100" },
    ],
  };
  const financialRates = { rep_sec_job_event_0: "1500", rep_sec_job_event_1: "5" };

  it("gives each entry its own job with its globals, rate, discount share and advance share", () => {
    const jobs = splitIntoJobs({ layout, fieldMap: JOB_FORM_FIELD_MAP, repeatableData, financialRates, installments: [{ amount: "400", date: "2026-10-22", paymentMode: "UPI" }], discount: 100, fallbackPackage: 0 });
    expect(jobs).toHaveLength(2);
    expect(jobs[0].globals).toEqual({ date: "2026-10-22", f_due: "2026-10-25" });
    expect(jobs[0].entry).toEqual({ category: "Flex Printing", f_size: "10 x 6", f_qty: "1" });
    expect(jobs[0].financialRates).toEqual({ rep_sec_job_event_0: "1500" });
    expect(jobs[1].financialRates).toEqual({ rep_sec_job_event_0: "5" });
    expect(jobs.map((j) => j.lineTotal)).toEqual([1500, 500]);
    // Discount 100 split 75 / 25; advance 400 split 300 / 100.
    expect(jobs.map((j) => j.packageAmount)).toEqual([1425, 475]);
    expect(jobs.map((j) => j.installments[0].amount)).toEqual(["300", "100"]);
    expect(jobs[0].installments[0].paymentMode).toBe("UPI");
  });

  it("puts everything on the first job when no line is priced", () => {
    const jobs = splitIntoJobs({ layout, fieldMap: JOB_FORM_FIELD_MAP, repeatableData, financialRates: {}, installments: [{ amount: "200", date: "2026-10-22", paymentMode: "Cash" }], discount: 0, fallbackPackage: 900 });
    expect(jobs.map((j) => j.packageAmount)).toEqual([900, 0]);
    expect(jobs[0].installments[0].amount).toBe("200");
    expect(jobs[1].installments).toEqual([]);
  });
});

describe("missingEntryFields", () => {
  it("reports mandatory item and global fields per entry, ignoring status pickers", () => {
    const missing = missingEntryFields(layout, JOB_FORM_FIELD_MAP, { rep_sec_job_event: [{ date: "2026-10-22", f_size: "A4" }, {}] }, () => true);
    expect(missing).toEqual([
      { index: 0, fieldName: "f_due", message: "Due date is required" },
      { index: 0, fieldName: "f_qty", message: "Quantity is required" },
      { index: 1, fieldName: "date", message: "Order Date is required" },
      { index: 1, fieldName: "f_due", message: "Due date is required" },
      { index: 1, fieldName: "f_size", message: "Size is required" },
      { index: 1, fieldName: "f_qty", message: "Quantity is required" },
    ]);
  });
});
