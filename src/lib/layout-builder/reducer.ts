/**
 * Pure state for the form-layout builder (settings → Layouts & Fields).
 *
 * Every edit targets the *active* layout (the one whose formKey === activeFormKey) and is a no-op when no
 * layout is open. Ids and form keys are passed in by the caller so the reducer stays deterministic.
 */
import { getFieldTypeDef, LOCKED_SECTION_ID } from "./fieldTypes";
import type { FieldPosition, FormField, FormLayout, FormSection } from "./types";

export interface LayoutBuilderState {
  layouts: FormLayout[];
  activeFormKey: string | null;
  selectedFieldId: string | null;
  /** True once the draft has been seeded from the first successful server load. */
  seeded: boolean;
  /** Undo / redo snapshots of the active layout (cleared when another form is opened). */
  past: FormLayout[];
  future: FormLayout[];
  /** Identifies a run of small edits (typing in one input) that share a single undo step. */
  coalesceKey: string | null;
  /** JSON of each layout as last loaded or saved, keyed by formKey; the draft is dirty when it differs. */
  baselines: Record<string, string>;
}

export const initialLayoutBuilderState: LayoutBuilderState = {
  layouts: [],
  activeFormKey: null,
  selectedFieldId: null,
  seeded: false,
  past: [],
  future: [],
  coalesceKey: null,
  baselines: {},
};

/** Most undo steps kept per open form. */
export const HISTORY_LIMIT = 60;

export type SectionEdits = Partial<Pick<FormSection, "title" | "description" | "isRepeatable">>;

export type LayoutBuilderAction =
  | { type: "seed"; defaults: FormLayout[]; fromServer: FormLayout[] }
  | { type: "openForm"; formKey: string }
  | { type: "closeForm" }
  | { type: "selectField"; fieldId: string | null }
  | { type: "createForm"; formKey: string; name: string; description: string }
  | { type: "addSection"; id: string }
  | { type: "updateSection"; sectionId: string; updates: SectionEdits }
  | { type: "setSectionIcon"; sectionId: string; icon: string }
  | { type: "removeSection"; sectionId: string }
  | { type: "moveSection"; sourceId: string; targetId: string }
  | { type: "addField"; sectionId: string; fieldType: string; id: string; index?: number }
  | { type: "moveField"; from: FieldPosition; toSectionId: string; toIndex: number }
  | { type: "updateField"; sectionId: string; fieldId: string; updates: Partial<FormField> }
  | { type: "updateSelectedField"; updates: Partial<FormField> }
  | { type: "removeField"; sectionId: string; fieldId: string }
  | { type: "duplicateField"; sectionId: string; fieldId: string; id: string }
  | { type: "setFieldArchived"; sectionId: string; fieldId: string; archived: boolean }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "markSaved"; formKey: string };

// ---------------------------------------------------------------------------------------------------------
// Helpers / selectors
// ---------------------------------------------------------------------------------------------------------

/** Defaults first (in their order), each replaced by the server copy with the same formKey; extra server layouts appended. */
export function mergeWithDefaults(defaults: FormLayout[], fromServer: FormLayout[]): FormLayout[] {
  const merged: FormLayout[] = [...defaults];
  fromServer.forEach((dbLayout) => {
    const idx = merged.findIndex((m) => m.formKey === dbLayout.formKey);
    if (idx >= 0) merged[idx] = dbLayout;
    else merged.push(dbLayout);
  });
  return merged;
}

/** Returns a copy of `items` with the element at `from` moved to index `to` (splice semantics). */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

export const getActiveLayout = (state: LayoutBuilderState): FormLayout | undefined =>
  state.layouts.find((l) => l.formKey === state.activeFormKey);

const snapshot = (layout: FormLayout) => JSON.stringify(layout);

/** True when the active layout differs from what was last loaded or saved. */
export const isDirty = (state: LayoutBuilderState): boolean => {
  const layout = getActiveLayout(state);
  return !!layout && state.baselines[layout.formKey] !== snapshot(layout);
};

export const canUndo = (state: LayoutBuilderState) => state.past.length > 0;
export const canRedo = (state: LayoutBuilderState) => state.future.length > 0;

/** Edits that share one undo step while they continue (typing into the same input). */
function coalesceKeyFor(action: LayoutBuilderAction, state: LayoutBuilderState): string | null {
  if (action.type === "updateField") return `field:${action.fieldId}:${Object.keys(action.updates).sort().join(",")}`;
  if (action.type === "updateSelectedField") return `field:${state.selectedFieldId}:${Object.keys(action.updates).sort().join(",")}`;
  if (action.type === "updateSection") return `section:${action.sectionId}:${Object.keys(action.updates).sort().join(",")}`;
  return null;
}

/** The selected field and the id of the section that contains it, within the active layout. */
export function findSelectedField(
  state: LayoutBuilderState,
): { field: FormField; sectionId: string } | null {
  const layout = getActiveLayout(state);
  if (!layout || !state.selectedFieldId) return null;
  for (const section of layout.schema.sections) {
    const field = section.fields.find((f) => f.id === state.selectedFieldId);
    if (field) return { field, sectionId: section.id };
  }
  return null;
}

export const getAllFields = (layout: FormLayout): FormField[] => layout.schema.sections.flatMap((s) => s.fields);

export const isSectionLocked = (section: FormSection): boolean =>
  section.id === LOCKED_SECTION_ID || !!section.locked;

/**
 * Another field in the layout already flagged as the record date (the last one wins), or null.
 * Always null when `field` itself is the record date, so it can be switched off.
 */
export function findOtherRecordDateField(layout: FormLayout, field: FormField): FormField | null {
  let existing: FormField | null = null;
  if (!field.isRecordDate) {
    layout.schema.sections.forEach((s) => {
      s.fields.forEach((f) => {
        if (f.id !== field.id && f.isRecordDate) existing = f;
      });
    });
  }
  return existing;
}

/** Deep copy of a field's plain-data settings (options, rules, unit lists). */
function structuredCloneField(field: FormField): FormField {
  return JSON.parse(JSON.stringify(field)) as FormField;
}

export function createField(id: string, fieldType: string): FormField {
  const typeDef = getFieldTypeDef(fieldType);
  return {
    id,
    name: typeDef ? typeDef.label : "New Field",
    type: fieldType,
    mandatory: false,
    options: ["Option 1", "Option 2", "Option 3"],
  };
}

// ---------------------------------------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------------------------------------

/** Replace the active layout's sections (matched by formKey). */
function withSections(state: LayoutBuilderState, layout: FormLayout, sections: FormSection[]): LayoutBuilderState {
  const updated: FormLayout = { ...layout, schema: { ...layout.schema, sections } };
  return { ...state, layouts: state.layouts.map((l) => (l.formKey === updated.formKey ? updated : l)) };
}

/**
 * Replace sections on every layout whose `id` equals the active layout's `id`.
 *
 * NOTE: kept verbatim from the original component for section-icon changes and section reordering. Layouts
 * that have never been saved have no `id`, so all of them (not just the active one) match `undefined === undefined`
 * and receive the active layout's sections. Preserved for a zero-behaviour-change refactor; likely a bug.
 */
function withSectionsById(state: LayoutBuilderState, layout: FormLayout, sections: FormSection[]): LayoutBuilderState {
  return {
    ...state,
    layouts: state.layouts.map((pl) => (pl.id === layout.id ? { ...pl, schema: { ...pl.schema, sections } } : pl)),
  };
}

const mapSection = (sections: FormSection[], sectionId: string, fn: (s: FormSection) => FormSection) =>
  sections.map((s) => (s.id === sectionId ? fn(s) : s));

/**
 * History-aware entry point: every change to the active layout becomes an undo step (runs of typing in one
 * input share a step), undo/redo swap snapshots, and `markSaved` resets the dirty baseline.
 */
export function layoutBuilderReducer(state: LayoutBuilderState, action: LayoutBuilderAction): LayoutBuilderState {
  const current = getActiveLayout(state);

  if (action.type === "undo") {
    if (!current || state.past.length === 0) return state;
    const previous = state.past[state.past.length - 1];
    return {
      ...state,
      layouts: state.layouts.map((l) => (l.formKey === previous.formKey ? previous : l)),
      past: state.past.slice(0, -1),
      future: [current, ...state.future],
      coalesceKey: null,
    };
  }
  if (action.type === "redo") {
    if (!current || state.future.length === 0) return state;
    const [next, ...rest] = state.future;
    return {
      ...state,
      layouts: state.layouts.map((l) => (l.formKey === next.formKey ? next : l)),
      past: [...state.past, current],
      future: rest,
      coalesceKey: null,
    };
  }
  if (action.type === "markSaved") {
    const layout = state.layouts.find((l) => l.formKey === action.formKey);
    return layout ? { ...state, baselines: { ...state.baselines, [action.formKey]: snapshot(layout) } } : state;
  }

  const next = coreReducer(state, action);
  const after = getActiveLayout(next);
  // Only edits to the open layout are undoable; navigation and selection are not.
  if (!current || !after || after === current || current.formKey !== after.formKey) return next;

  const key = coalesceKeyFor(action, state);
  if (key && key === state.coalesceKey) return { ...next, coalesceKey: key };
  return {
    ...next,
    past: [...state.past, current].slice(-HISTORY_LIMIT),
    future: [],
    coalesceKey: key,
  };
}

function coreReducer(state: LayoutBuilderState, action: LayoutBuilderAction): LayoutBuilderState {
  switch (action.type) {
    case "seed": {
      if (state.seeded) return state;
      const layouts = mergeWithDefaults(action.defaults, action.fromServer);
      const baselines: Record<string, string> = {};
      layouts.forEach((l) => { baselines[l.formKey] = snapshot(l); });
      return { ...state, seeded: true, layouts, baselines };
    }

    case "openForm":
      return { ...state, activeFormKey: action.formKey, past: [], future: [], coalesceKey: null };

    case "closeForm":
      return { ...state, activeFormKey: null, selectedFieldId: null, past: [], future: [], coalesceKey: null };

    case "selectField":
      return { ...state, selectedFieldId: action.fieldId };

    case "createForm": {
      const newForm: FormLayout = {
        formKey: action.formKey,
        name: action.name,
        description: action.description,
        schema: { sections: [] },
      };
      return { ...state, layouts: [...state.layouts, newForm], activeFormKey: action.formKey, past: [], future: [], coalesceKey: null };
    }
  }

  const layout = getActiveLayout(state);
  if (!layout) return state;
  const sections = layout.schema.sections;

  switch (action.type) {
    case "addSection": {
      const newSection: FormSection = {
        id: action.id,
        title: `Untitled Section ${(sections?.length || 0) + 1}`,
        description: "Section description goes here.",
        icon: "ph-squares-four",
        fields: [],
      };
      return withSections(state, layout, [...(sections || []), newSection]);
    }

    case "updateSection":
      return withSections(state, layout, mapSection(sections, action.sectionId, (s) => ({ ...s, ...action.updates })));

    case "setSectionIcon": {
      const sIdx = sections.findIndex((s) => s.id === action.sectionId);
      if (sIdx === -1) return state;
      const newS = [...sections];
      newS[sIdx] = { ...newS[sIdx], icon: action.icon };
      return withSectionsById(state, layout, newS);
    }

    case "removeSection": {
      const selectedSectionId = findSelectedField(state)?.sectionId ?? null;
      const next = withSections(state, layout, sections.filter((s) => s.id !== action.sectionId));
      return selectedSectionId === action.sectionId ? { ...next, selectedFieldId: null } : next;
    }

    case "moveSection": {
      if (action.sourceId === action.targetId) return state;
      const sourceIdx = sections.findIndex((s) => s.id === action.sourceId);
      const targetIdx = sections.findIndex((s) => s.id === action.targetId);
      if (sourceIdx === -1 || targetIdx === -1) return state;
      return withSectionsById(state, layout, moveItem(sections, sourceIdx, targetIdx));
    }

    case "addField": {
      const newField = createField(action.id, action.fieldType);
      const { index } = action;
      const next = withSections(
        state,
        layout,
        mapSection(sections, action.sectionId, (s) => {
          if (index === undefined) return { ...s, fields: [...(s.fields || []), newField] };
          const newFields = [...(s.fields || [])];
          newFields.splice(index, 0, newField);
          return { ...s, fields: newFields };
        }),
      );
      return { ...next, selectedFieldId: newField.id };
    }

    case "moveField": {
      const { sectionId: sourceSectionId, fieldIndex: sourceIndex } = action.from;
      const field = sections.find((s) => s.id === sourceSectionId)?.fields[sourceIndex];
      if (!field) return state;
      const tempSections = mapSection(sections, sourceSectionId, (s) => {
        const fields = [...s.fields];
        fields.splice(sourceIndex, 1);
        return { ...s, fields };
      });

      // Moving down within the same section: the removal shifted the target index by one.
      let adjustedTargetIndex = action.toIndex;
      if (sourceSectionId === action.toSectionId && sourceIndex < action.toIndex) adjustedTargetIndex--;

      const finalSections = mapSection(tempSections, action.toSectionId, (s) => {
        const fields = [...s.fields];
        fields.splice(adjustedTargetIndex, 0, field);
        return { ...s, fields };
      });
      return withSections(state, layout, finalSections);
    }

    case "updateField":
      return withSections(
        state,
        layout,
        mapSection(sections, action.sectionId, (s) => ({
          ...s,
          fields: s.fields.map((f) => (f.id === action.fieldId ? { ...f, ...action.updates } : f)),
        })),
      );

    case "updateSelectedField": {
      const selected = findSelectedField(state);
      if (!selected) return state;
      return layoutBuilderReducer(state, {
        type: "updateField",
        sectionId: selected.sectionId,
        fieldId: selected.field.id,
        updates: action.updates,
      });
    }

    case "removeField": {
      const next = withSections(
        state,
        layout,
        mapSection(sections, action.sectionId, (s) => ({ ...s, fields: s.fields.filter((f) => f.id !== action.fieldId) })),
      );
      return state.selectedFieldId === action.fieldId ? { ...next, selectedFieldId: null } : next;
    }

    case "duplicateField": {
      const section = sections.find((s) => s.id === action.sectionId);
      const idx = section?.fields.findIndex((f) => f.id === action.fieldId) ?? -1;
      if (!section || idx === -1) return state;
      const source = section.fields[idx];
      // A copy is a new field: it gets its own id and never inherits the single record-date role.
      const copy: FormField = { ...structuredCloneField(source), id: action.id, name: `${source.name ?? "Field"} (copy)`, isRecordDate: false };
      const fields = [...section.fields];
      fields.splice(idx + 1, 0, copy);
      const next = withSections(state, layout, mapSection(sections, action.sectionId, (s) => ({ ...s, fields })));
      return { ...next, selectedFieldId: copy.id };
    }

    case "setFieldArchived":
      return withSections(
        state,
        layout,
        mapSection(sections, action.sectionId, (s) => ({
          ...s,
          fields: s.fields.map((f) => (f.id === action.fieldId ? { ...f, archived: action.archived || undefined } : f)),
        })),
      );

    default:
      return state;
  }
}
