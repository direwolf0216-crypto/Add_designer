import type { FormLayout } from "./types";

/**
 * The layout without archived fields, for the create/edit forms. Details, exports and reports keep
 * reading the full layout so values saved under an archived field remain visible.
 */
export function withoutArchivedFields<T extends FormLayout | null | undefined>(layout: T): T {
  if (!layout || !layout.sections) return layout;
  if (!layout.sections.some((s) => s.fields?.some((f) => f.archived))) return layout;
  return { ...layout, sections: layout.sections.map((s) => ({ ...s, fields: (s.fields ?? []).filter((f) => !f.archived) })) } as T;
}
