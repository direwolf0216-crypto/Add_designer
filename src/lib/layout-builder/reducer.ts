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
}

export const initialLayoutBuilderState: LayoutBuilderState = {
  layouts: [],
  activeFormKey: null,
  selectedFieldId: null,
  seeded: false,
};

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
  | { type: "removeField"; sectionId: string; fieldId: string };

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

export function layoutBuilderReducer(state: LayoutBuilderState, action: LayoutBuilderAction): LayoutBuilderState {
  switch (action.type) {
    case "seed":
      if (state.seeded) return state;
      return { ...state, seeded: true, layouts: mergeWithDefaults(action.defaults, action.fromServer) };

    case "openForm":
      return { ...state, activeFormKey: action.formKey };

    case "closeForm":
      return { ...state, activeFormKey: null, selectedFieldId: null };

    case "selectField":
      return { ...state, selectedFieldId: action.fieldId };

    case "createForm": {
      const newForm: FormLayout = {
        formKey: action.formKey,
        name: action.name,
        description: action.description,
        schema: { sections: [] },
      };
      return { ...state, layouts: [...state.layouts, newForm], activeFormKey: action.formKey };
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

    default:
      return state;
  }
}
