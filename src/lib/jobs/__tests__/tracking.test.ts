import { describe, expect, it } from "vitest";
import { deriveJobTracking, dueDateFieldId, stageOptions } from "../tracking";

const layout = {
  sections: [
    { id: "sec_job_event", isRepeatable: true, fields: [
      { id: "fld_b_date", name: "Order Date", type: "DATE" },
      { id: "field_due", name: "Due date", type: "DATE" },
      { id: "fld_b_status", name: "Status", type: "STATUS_PICKER", statusOptions: [{ label: "Pending", color: "bg-red-500" }, { label: "Printing", color: "bg-blue-500" }] },
    ] },
  ],
};

describe("job tracking", () => {
  it("finds the due date field and stages from the layout", () => {
    expect(dueDateFieldId(layout)).toBe("field_due");
    expect(stageOptions(layout).map((s) => s.label)).toEqual(["Pending", "Printing"]);
    expect(stageOptions(null)[0].label).toBe("Pending");
  });

  it("reads the first line item (stored as a JSON string by the form)", () => {
    const cd = { rep_sec_job_event: JSON.stringify([{ status: "Printing", field_due: "2026-11-02" }, { status: "Pending" }]) };
    const t = deriveJobTracking(cd, layout);
    expect(t.stage).toBe("Printing");
    expect(t.dueDate?.toISOString()).toBe("2026-11-02T00:00:00.000Z");
  });

  it("prefers the top-level board stage and tolerates junk", () => {
    expect(deriveJobTracking({ fld_b_status: "Ready for Delivery", rep_x: "not json" }, layout)).toEqual({ stage: "Ready for Delivery", dueDate: null });
    expect(deriveJobTracking(null, layout)).toEqual({ stage: null, dueDate: null });
  });
});

describe("designing completed", () => {
  const withDone = {
    sections: [
      { id: "sec_job_event", fields: [
        { id: "fld_b_status", type: "STATUS_PICKER", statusOptions: [{ label: "Designing" }, { label: "Designing Completed" }, { label: "Printing" }] },
      ] },
    ],
  };

  it("is its own board column, between Designing and Printing", () => {
    expect(stageOptions(withDone).map((s) => s.label)).toEqual(["Designing", "Designing Completed", "Printing"]);
    expect(stageOptions(null).map((s) => s.label).slice(1, 4)).toEqual(["Designing", "Designing Completed", "Printing"]);
  });

  it("puts the job in that column", () => {
    expect(deriveJobTracking({ fld_b_status: "Designing Completed" }, withDone).stage).toBe("Designing Completed");
  });
});
