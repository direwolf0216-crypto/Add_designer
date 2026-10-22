import { describe, expect, it } from "vitest";
import { isHiddenFor, isReadOnlyFor, layoutForViewer } from "../audience";
import type { FormLayout } from "../types";

const layout: FormLayout = {
  sections: [{ id: "s", title: "S", fields: [
    { id: "a", name: "Price", type: "CURRENCY", audience: { hideFor: ["role:STAFF", "team:t1"] } },
    { id: "b", name: "Status", type: "STATUS_PICKER", audience: { readOnlyFor: ["custom:c9"] } },
    { id: "c", name: "Notes", type: "SINGLE_LINE" },
  ] }],
};

describe("field audience", () => {
  it("hides and locks per role, custom role and team; admins bypass", () => {
    const staff = { role: "STAFF", teamIds: [] };
    expect(isHiddenFor(layout.sections[0].fields[0].audience, staff)).toBe(true);
    expect(isHiddenFor(layout.sections[0].fields[0].audience, { role: "MANAGER", teamIds: ["t1"] })).toBe(true);
    expect(isHiddenFor(layout.sections[0].fields[0].audience, { role: "MANAGER", teamIds: [] })).toBe(false);
    expect(isReadOnlyFor(layout.sections[0].fields[1].audience, { role: "CUSTOM", customRoleId: "c9", teamIds: [] })).toBe(true);
    expect(isHiddenFor(layout.sections[0].fields[0].audience, { role: "ADMIN", teamIds: ["t1"] })).toBe(false);
  });

  it("filters the layout for a viewer and leaves it untouched otherwise", () => {
    const forStaff = layoutForViewer(layout, { role: "STAFF", customRoleId: "c9", teamIds: [] });
    expect(forStaff.sections[0].fields.map((f) => f.id)).toEqual(["b", "c"]);
    expect(forStaff.sections[0].fields[0].lockedForViewer).toBe(true);
    expect(layoutForViewer(layout, { role: "MANAGER", teamIds: [] })).toBe(layout);
    expect(layoutForViewer(layout, null)).toBe(layout);
  });
});
