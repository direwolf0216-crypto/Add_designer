import { describe, expect, it } from "vitest";
import { diffJob, layoutFieldLabels, summarizeChanges } from "../diffJob";

describe("diffJob", () => {
  it("reports standard field changes with readable values", () => {
    const changes = diffJob(
      { status: "Designing", date: new Date("2026-10-20T00:00:00Z"), packageAmount: 1000 },
      { status: "Printing", date: "2026-10-22", packageAmount: 1000 }
    );
    expect(changes).toEqual([
      { field: "date", label: "Job date", from: "2026-10-20", to: "2026-10-22" },
      { field: "status", label: "Status", from: "Designing", to: "Printing" },
    ]);
  });

  it("labels custom fields from the layout and hides bookkeeping keys", () => {
    const labels = layoutFieldLabels({ sections: [{ fields: [{ id: "field_1", name: "Due date" }] }] });
    const changes = diffJob(
      { customData: { field_1: "2026-10-01", fld_financial_rates: "{}" } },
      { customData: { field_1: "2026-10-05", fld_financial_rates: '{"a":1}' } },
      labels
    );
    expect(changes).toEqual([{ field: "field_1", label: "Due date", from: "2026-10-01", to: "2026-10-05" }]);
  });

  it("ignores fields absent from the new snapshot and unchanged values", () => {
    expect(diffJob({ status: "A", location: "X" }, { status: "A" })).toEqual([]);
  });

  it("summarises", () => {
    expect(summarizeChanges([])).toBe("Saved without changes");
    expect(
      summarizeChanges([
        { field: "a", label: "Status", from: null, to: "x" },
        { field: "b", label: "Due date", from: null, to: "y" },
        { field: "c", label: "Size", from: null, to: "z" },
      ])
    ).toBe("Changed Status, Due date and 1 more");
  });
});
