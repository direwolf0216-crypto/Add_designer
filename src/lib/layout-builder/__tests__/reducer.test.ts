import { describe, expect, it } from "vitest";
import {
  findOtherRecordDateField,
  findSelectedField,
  getActiveLayout,
  initialLayoutBuilderState,
  layoutBuilderReducer as reduce,
  mergeWithDefaults,
  moveItem,
  type LayoutBuilderState,
} from "../reducer";
import type { FormField, FormLayout } from "../types";

const field = (id: string, extra: Partial<FormField> = {}): FormField => ({ id, name: id, type: "SINGLE_LINE", mandatory: false, ...extra });

const layout = (formKey: string, extra: Partial<FormLayout> = {}): FormLayout => ({
  id: `id_${formKey}`,
  formKey,
  name: formKey,
  description: "",
  schema: {
    sections: [
      { id: "s1", title: "One", fields: [field("a"), field("b"), field("c")] },
      { id: "s2", title: "Two", fields: [field("d")] },
    ],
  },
  ...extra,
});

const stateWith = (overrides: Partial<LayoutBuilderState> = {}): LayoutBuilderState => ({
  ...initialLayoutBuilderState,
  seeded: true,
  layouts: [layout("JOB"), layout("TX")],
  activeFormKey: "JOB",
  ...overrides,
});

const fieldIds = (s: LayoutBuilderState, sectionId: string) =>
  getActiveLayout(s)!.schema.sections.find((x) => x.id === sectionId)!.fields.map((f) => f.id);

describe("mergeWithDefaults / seed", () => {
  it("replaces defaults by formKey and appends extra server layouts", () => {
    const merged = mergeWithDefaults(
      [layout("A", { name: "default A" }), layout("B")],
      [layout("B", { name: "server B" }), layout("C")],
    );
    expect(merged.map((l) => [l.formKey, l.name])).toEqual([["A", "default A"], ["B", "server B"], ["C", "C"]]);
  });

  it("seeds only once", () => {
    const once = reduce(initialLayoutBuilderState, { type: "seed", defaults: [layout("A")], fromServer: [] });
    expect(once.seeded).toBe(true);
    const twice = reduce(once, { type: "seed", defaults: [layout("Z")], fromServer: [] });
    expect(twice).toBe(once);
  });
});

describe("moveItem", () => {
  it("uses splice semantics", () => {
    expect(moveItem(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
    expect(moveItem(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
  });
});

describe("navigation & selection", () => {
  it("closeForm clears active form and selection", () => {
    const s = reduce(stateWith({ selectedFieldId: "a" }), { type: "closeForm" });
    expect(s.activeFormKey).toBeNull();
    expect(s.selectedFieldId).toBeNull();
  });

  it("createForm appends an empty layout and opens it", () => {
    const s = reduce(stateWith({ activeFormKey: null }), { type: "createForm", formKey: "NEW_1", name: "New", description: "d" });
    expect(s.activeFormKey).toBe("NEW_1");
    expect(s.layouts.at(-1)).toEqual({ formKey: "NEW_1", name: "New", description: "d", schema: { sections: [] } });
  });

  it("findSelectedField returns the field and its section", () => {
    const sel = findSelectedField(stateWith({ selectedFieldId: "d" }));
    expect(sel?.field.id).toBe("d");
    expect(sel?.sectionId).toBe("s2");
  });

  it("edits are no-ops without an active layout", () => {
    const s = stateWith({ activeFormKey: null });
    expect(reduce(s, { type: "addSection", id: "x" })).toBe(s);
  });
});

describe("sections", () => {
  it("addSection appends a numbered untitled section", () => {
    const s = reduce(stateWith(), { type: "addSection", id: "sec_1" });
    expect(getActiveLayout(s)!.schema.sections.at(-1)).toEqual({
      id: "sec_1",
      title: "Untitled Section 3",
      description: "Section description goes here.",
      icon: "ph-squares-four",
      fields: [],
    });
    // other layouts untouched
    expect(s.layouts[1].schema.sections).toHaveLength(2);
  });

  it("updateSection merges title / description / isRepeatable", () => {
    const s = reduce(stateWith(), { type: "updateSection", sectionId: "s2", updates: { title: "T", isRepeatable: true } });
    expect(getActiveLayout(s)!.schema.sections[1]).toMatchObject({ id: "s2", title: "T", isRepeatable: true });
  });

  it("setSectionIcon sets the icon", () => {
    const s = reduce(stateWith(), { type: "setSectionIcon", sectionId: "s1", icon: "ph-star" });
    expect(getActiveLayout(s)!.schema.sections[0].icon).toBe("ph-star");
    expect(s.layouts[1].schema.sections[0].icon).toBeUndefined();
  });

  it("removeSection clears the selection when the selected field lived there", () => {
    const s = reduce(stateWith({ selectedFieldId: "b" }), { type: "removeSection", sectionId: "s1" });
    expect(getActiveLayout(s)!.schema.sections.map((x) => x.id)).toEqual(["s2"]);
    expect(s.selectedFieldId).toBeNull();
    const kept = reduce(stateWith({ selectedFieldId: "d" }), { type: "removeSection", sectionId: "s1" });
    expect(kept.selectedFieldId).toBe("d");
  });

  it("moveSection reorders and ignores self / unknown targets", () => {
    const s = reduce(stateWith(), { type: "moveSection", sourceId: "s2", targetId: "s1" });
    expect(getActiveLayout(s)!.schema.sections.map((x) => x.id)).toEqual(["s2", "s1"]);
    const same = stateWith();
    expect(reduce(same, { type: "moveSection", sourceId: "s1", targetId: "s1" })).toBe(same);
    expect(reduce(same, { type: "moveSection", sourceId: "s1", targetId: "nope" })).toBe(same);
  });
});

describe("fields", () => {
  it("addField appends a typed field with default options and selects it", () => {
    const s = reduce(stateWith(), { type: "addField", sectionId: "s2", fieldType: "DATE", id: "f_new" });
    expect(fieldIds(s, "s2")).toEqual(["d", "f_new"]);
    expect(getActiveLayout(s)!.schema.sections[1].fields[1]).toEqual({
      id: "f_new",
      name: "Date",
      type: "DATE",
      mandatory: false,
      options: ["Option 1", "Option 2", "Option 3"],
    });
    expect(s.selectedFieldId).toBe("f_new");
  });

  it("addField inserts at an index; unknown types are named 'New Field'", () => {
    const s = reduce(stateWith(), { type: "addField", sectionId: "s1", fieldType: "WHATEVER", id: "x", index: 1 });
    expect(fieldIds(s, "s1")).toEqual(["a", "x", "b", "c"]);
    expect(findSelectedField(s)?.field.name).toBe("New Field");
  });

  it("moveField moves down within a section (target index adjusted)", () => {
    // Dropping "a" on the slot of "c" (index 2) lands it before "c".
    const s = reduce(stateWith(), { type: "moveField", from: { sectionId: "s1", fieldIndex: 0 }, toSectionId: "s1", toIndex: 2 });
    expect(fieldIds(s, "s1")).toEqual(["b", "a", "c"]);
    // Dropping on the section's end slot (index === length) appends.
    const end = reduce(stateWith(), { type: "moveField", from: { sectionId: "s1", fieldIndex: 0 }, toSectionId: "s1", toIndex: 3 });
    expect(fieldIds(end, "s1")).toEqual(["b", "c", "a"]);
  });

  it("moveField moves up and across sections", () => {
    const up = reduce(stateWith(), { type: "moveField", from: { sectionId: "s1", fieldIndex: 2 }, toSectionId: "s1", toIndex: 0 });
    expect(fieldIds(up, "s1")).toEqual(["c", "a", "b"]);
    const across = reduce(stateWith(), { type: "moveField", from: { sectionId: "s1", fieldIndex: 1 }, toSectionId: "s2", toIndex: 0 });
    expect(fieldIds(across, "s1")).toEqual(["a", "c"]);
    expect(fieldIds(across, "s2")).toEqual(["b", "d"]);
  });

  it("moveField with a missing source is a no-op", () => {
    const s = stateWith();
    expect(reduce(s, { type: "moveField", from: { sectionId: "s1", fieldIndex: 9 }, toSectionId: "s2", toIndex: 0 })).toBe(s);
  });

  it("updateSelectedField patches only the selected field", () => {
    const s = reduce(stateWith({ selectedFieldId: "b" }), { type: "updateSelectedField", updates: { mandatory: true, name: "B!" } });
    expect(findSelectedField(s)?.field).toMatchObject({ id: "b", mandatory: true, name: "B!" });
    expect(getActiveLayout(s)!.schema.sections[0].fields[0].mandatory).toBe(false);
    const none = stateWith();
    expect(reduce(none, { type: "updateSelectedField", updates: { name: "x" } })).toBe(none);
  });

  it("updateField patches a specific field", () => {
    const s = reduce(stateWith(), { type: "updateField", sectionId: "s2", fieldId: "d", updates: { options: ["x"] } });
    expect(getActiveLayout(s)!.schema.sections[1].fields[0].options).toEqual(["x"]);
  });

  it("removeField drops the field and clears selection if it was selected", () => {
    const s = reduce(stateWith({ selectedFieldId: "a" }), { type: "removeField", sectionId: "s1", fieldId: "a" });
    expect(fieldIds(s, "s1")).toEqual(["b", "c"]);
    expect(s.selectedFieldId).toBeNull();
    const kept = reduce(stateWith({ selectedFieldId: "b" }), { type: "removeField", sectionId: "s1", fieldId: "a" });
    expect(kept.selectedFieldId).toBe("b");
  });
});

describe("findOtherRecordDateField", () => {
  it("finds the last other record-date field, unless the field itself is the record date", () => {
    const l = layout("X", {
      schema: {
        sections: [
          { id: "s1", title: "", fields: [field("d1", { type: "DATE", isRecordDate: true }), field("d2", { type: "DATE" })] },
          { id: "s2", title: "", fields: [field("d3", { type: "DATE", isRecordDate: true })] },
        ],
      },
    });
    const [d1, d2] = l.schema.sections[0].fields;
    expect(findOtherRecordDateField(l, d2)?.id).toBe("d3");
    expect(findOtherRecordDateField(l, d1)).toBeNull();
  });
});

describe("history, dirty tracking and field housekeeping", () => {
  const seeded = () => {
    const s = reduce(initialLayoutBuilderState, { type: "seed", defaults: [layout("JOB")], fromServer: [] });
    return reduce(s, { type: "openForm", formKey: "JOB" });
  };

  it("is clean after loading and dirty after an edit, clean again once saved", async () => {
    const { isDirty } = await import("../reducer");
    let s = seeded();
    expect(isDirty(s)).toBe(false);
    s = reduce(s, { type: "updateField", sectionId: "s1", fieldId: "a", updates: { name: "Renamed" } });
    expect(isDirty(s)).toBe(true);
    s = reduce(s, { type: "markSaved", formKey: "JOB" });
    expect(isDirty(s)).toBe(false);
  });

  it("undoes and redoes layout edits but not selection", async () => {
    const { canUndo, canRedo } = await import("../reducer");
    let s = seeded();
    s = reduce(s, { type: "selectField", fieldId: "a" });
    expect(canUndo(s)).toBe(false);
    s = reduce(s, { type: "removeField", sectionId: "s1", fieldId: "a" });
    expect(fieldIds(s, "s1")).toEqual(["b", "c"]);
    s = reduce(s, { type: "undo" });
    expect(fieldIds(s, "s1")).toEqual(["a", "b", "c"]);
    expect(canRedo(s)).toBe(true);
    s = reduce(s, { type: "redo" });
    expect(fieldIds(s, "s1")).toEqual(["b", "c"]);
  });

  it("groups a run of typing into one undo step and a new edit clears redo", () => {
    let s = seeded();
    s = reduce(s, { type: "updateField", sectionId: "s1", fieldId: "a", updates: { name: "S" } });
    s = reduce(s, { type: "updateField", sectionId: "s1", fieldId: "a", updates: { name: "Si" } });
    s = reduce(s, { type: "updateField", sectionId: "s1", fieldId: "a", updates: { name: "Siz" } });
    expect(s.past).toHaveLength(1);
    s = reduce(s, { type: "undo" });
    expect(getActiveLayout(s)!.schema.sections[0].fields[0].name).toBe("a");
    s = reduce(s, { type: "updateField", sectionId: "s1", fieldId: "b", updates: { mandatory: true } });
    expect(s.future).toHaveLength(0);
  });

  it("clears history when another form is opened", () => {
    let s = reduce(initialLayoutBuilderState, { type: "seed", defaults: [layout("JOB"), layout("TX")], fromServer: [] });
    s = reduce(s, { type: "openForm", formKey: "JOB" });
    s = reduce(s, { type: "removeField", sectionId: "s1", fieldId: "a" });
    s = reduce(s, { type: "closeForm" });
    s = reduce(s, { type: "openForm", formKey: "TX" });
    expect(s.past).toHaveLength(0);
  });

  it("duplicates a field right after the original with a fresh id and no record-date role", () => {
    let s = seeded();
    s = reduce(s, { type: "updateField", sectionId: "s1", fieldId: "a", updates: { isRecordDate: true, options: ["x"], placeholder: "hint" } });
    s = reduce(s, { type: "duplicateField", sectionId: "s1", fieldId: "a", id: "a2" });
    expect(fieldIds(s, "s1")).toEqual(["a", "a2", "b", "c"]);
    const copy = getActiveLayout(s)!.schema.sections[0].fields[1];
    expect(copy).toMatchObject({ id: "a2", name: "a (copy)", isRecordDate: false, options: ["x"], placeholder: "hint" });
    expect(s.selectedFieldId).toBe("a2");
  });

  it("archives and restores a field", () => {
    let s = seeded();
    s = reduce(s, { type: "setFieldArchived", sectionId: "s1", fieldId: "b", archived: true });
    expect(getActiveLayout(s)!.schema.sections[0].fields[1].archived).toBe(true);
    s = reduce(s, { type: "setFieldArchived", sectionId: "s1", fieldId: "b", archived: false });
    expect(getActiveLayout(s)!.schema.sections[0].fields[1].archived).toBeUndefined();
  });
});

describe("field roles in the builder", () => {
  it("fills roles from labels when seeding the job form and keeps the draft clean", async () => {
    const { isDirty } = await import("../reducer");
    const job = layout("JOB_FORM", { schema: { sections: [{ id: "s", title: "S", fields: [field("f1", { name: "Due date", type: "DATE" }), field("f2", { name: "Quantity", type: "NUMBER" })] }] } });
    let s = reduce(initialLayoutBuilderState, { type: "seed", defaults: [], fromServer: [job] });
    s = reduce(s, { type: "openForm", formKey: "JOB_FORM" });
    expect(getActiveLayout(s)!.schema.sections[0].fields.map((f) => f.role)).toEqual(["dueDate", "quantity"]);
    expect(isDirty(s)).toBe(false);
  });

  it("moves a role to the field it is assigned to", () => {
    let s = reduce(initialLayoutBuilderState, { type: "seed", defaults: [layout("JOB_FORM")], fromServer: [] });
    s = reduce(s, { type: "openForm", formKey: "JOB_FORM" });
    s = reduce(s, { type: "setFieldRole", fieldId: "a", role: "quantity" });
    s = reduce(s, { type: "setFieldRole", fieldId: "b", role: "quantity" });
    const roles = Object.fromEntries(getActiveLayout(s)!.schema.sections.flatMap((x) => x.fields).map((f) => [f.id, f.role]));
    expect(roles).toMatchObject({ a: undefined, b: "quantity" });
    s = reduce(s, { type: "setFieldRole", fieldId: "b", role: null });
    expect(getActiveLayout(s)!.schema.sections[0].fields[1].role).toBeUndefined();
  });
});
