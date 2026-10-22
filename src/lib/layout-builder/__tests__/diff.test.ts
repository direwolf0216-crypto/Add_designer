import { describe, expect, it } from "vitest";
import { diffLayouts, summarizeChanges } from "../diff";
import type { FormLayout } from "@/lib/forms/types";

const base: FormLayout = {
  sections: [
    { id: "s1", title: "Client", fields: [
      { id: "a", name: "Client", type: "SINGLE_LINE", mandatory: true },
      { id: "b", name: "Phone", type: "PHONE" },
    ] },
    { id: "s2", title: "Job", fields: [{ id: "c", name: "Size", type: "SINGLE_LINE" }] },
  ],
};

describe("diffLayouts", () => {
  it("reports no changes for identical schemas", () => {
    expect(diffLayouts(base, JSON.parse(JSON.stringify(base)))).toEqual([]);
    expect(summarizeChanges([])).toBe("No changes");
  });

  it("describes adds, removes, renames, type changes, moves and settings", () => {
    const next: FormLayout = {
      sections: [
        { id: "s1", title: "Customer", fields: [
          { id: "b", name: "Mobile", type: "PHONE", validation: { pattern: "phone" } },
          { id: "c", name: "Size", type: "SIZE" },
          { id: "d", name: "Email", type: "EMAIL" },
        ] },
      ],
    };
    const texts = diffLayouts(base, next).map((c) => c.text);
    expect(texts).toEqual(expect.arrayContaining([
      "Section “Client” renamed to “Customer”",
      "Section “Job” removed with 1 field",
      "“Phone” renamed to “Mobile”",
      "Mobile: validation changed",
      "Size: type SINGLE_LINE → SIZE",
      "Size moved to “Customer”",
      "Email added (email) in “Customer”",
      "Client removed",
    ]));
    const removed = diffLayouts(base, next).find((c) => c.text === "Client removed");
    expect(removed?.affectsData).toBe(true);
    expect(summarizeChanges(diffLayouts(base, next))).toMatch(/hides? saved values/);
  });

  it("does not call a field reordered when an earlier field was simply deleted", () => {
    const next: FormLayout = { sections: [{ id: "s1", title: "Client", fields: [{ id: "b", name: "Phone", type: "PHONE" }] }, base.sections[1]] };
    expect(diffLayouts(base, next).map((c) => c.kind)).toEqual(["field_removed"]);
  });

  it("words required and archive changes plainly", () => {
    const next: FormLayout = { sections: [{ id: "s1", title: "Client", fields: [{ id: "a", name: "Client", type: "SINGLE_LINE" }, { id: "b", name: "Phone", type: "PHONE", archived: true }] }, base.sections[1]] };
    expect(diffLayouts(base, next).map((c) => c.text)).toEqual(["Client: no longer required", "Phone archived (hidden from the form)"]);
  });
});
