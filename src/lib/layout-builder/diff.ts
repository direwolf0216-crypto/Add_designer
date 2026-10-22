// Field-level differences between two layout schemas, for the publish summary and version history.
import type { FormField as BaseField, FormLayout, FormSection } from "@/lib/forms/types";

/** Older default layouts name fields with `label`. */
type FormField = BaseField & { label?: string };

export type LayoutChangeKind =
  | "section_added"
  | "section_removed"
  | "section_renamed"
  | "field_added"
  | "field_removed"
  | "field_renamed"
  | "field_type"
  | "field_moved"
  | "field_archived"
  | "field_restored"
  | "field_settings";

export interface LayoutChange {
  kind: LayoutChangeKind;
  /** Human text, e.g. “Size: now required”. */
  text: string;
  /** True when existing records may lose a visible value (removed fields). */
  affectsData?: boolean;
}

type Schema = Pick<FormLayout, "sections"> | null | undefined;

const nameOf = (f: FormField) => f.name || f.label || f.id;

/** Settings compared one by one; anything else is summarised as "settings changed". */
const SETTING_LABELS: Record<string, string> = {
  mandatory: "required",
  mandatoryRule: "required-when rule",
  visibilityRule: "visibility rule",
  validation: "validation",
  defaultValue: "default value",
  placeholder: "sample text",
  options: "options",
  statusOptions: "status options",
  role: "role",
  sizeUnits: "units",
  defaultUnit: "preselected unit",
  isRepeatableField: "per-entry setting",
  isRecordDate: "record-date flag",
  userPicklistConfig: "user picker settings",
  restrictFutureDate: "date restriction",
  futureDateRestriction: "stage restriction",
};

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

function indexFields(schema: Schema) {
  const out = new Map<string, { field: FormField; section: FormSection; index: number }>();
  schema?.sections?.forEach((section) => section.fields?.forEach((field, index) => out.set(field.id, { field, section, index })));
  return out;
}

export function diffLayouts(before: Schema, after: Schema): LayoutChange[] {
  const changes: LayoutChange[] = [];
  const beforeSections = new Map((before?.sections ?? []).map((s) => [s.id, s]));
  const afterSections = new Map((after?.sections ?? []).map((s) => [s.id, s]));

  afterSections.forEach((s, id) => {
    const prev = beforeSections.get(id);
    if (!prev) changes.push({ kind: "section_added", text: `Section “${s.title || "Untitled"}” added` });
    else if ((prev.title || "") !== (s.title || "")) changes.push({ kind: "section_renamed", text: `Section “${prev.title || "Untitled"}” renamed to “${s.title || "Untitled"}”` });
  });
  beforeSections.forEach((s, id) => {
    if (!afterSections.has(id)) {
      const n = s.fields?.length ?? 0;
      changes.push({ kind: "section_removed", text: `Section “${s.title || "Untitled"}” removed${n ? ` with ${n} field${n === 1 ? "" : "s"}` : ""}`, affectsData: n > 0 });
    }
  });

  const b = indexFields(before);
  const a = indexFields(after);

  a.forEach((cur, id) => {
    const prev = b.get(id);
    const name = nameOf(cur.field);
    if (!prev) {
      changes.push({ kind: "field_added", text: `${name} added (${cur.field.type.toLowerCase().replace(/_/g, " ")}) in “${cur.section.title || "Untitled"}”` });
      return;
    }
    if (nameOf(prev.field) !== name) changes.push({ kind: "field_renamed", text: `“${nameOf(prev.field)}” renamed to “${name}”` });
    if (prev.field.type !== cur.field.type) changes.push({ kind: "field_type", text: `${name}: type ${prev.field.type} → ${cur.field.type}` });
    if (!prev.field.archived && cur.field.archived) changes.push({ kind: "field_archived", text: `${name} archived (hidden from the form)` });
    if (prev.field.archived && !cur.field.archived) changes.push({ kind: "field_restored", text: `${name} restored to the form` });
    if (prev.section.id !== cur.section.id) changes.push({ kind: "field_moved", text: `${name} moved to “${cur.section.title || "Untitled"}”` });
    else if (prev.index !== cur.index && !sectionOrderOnly(prev, cur, b, a)) changes.push({ kind: "field_moved", text: `${name} reordered` });

    const changed = Object.keys(SETTING_LABELS).filter((k) => !same((prev.field as unknown as Record<string, unknown>)[k], (cur.field as unknown as Record<string, unknown>)[k]));
    if (changed.length) {
      const req = changed.includes("mandatory") ? (cur.field.mandatory ? "now required" : "no longer required") : null;
      const rest = changed.filter((k) => k !== "mandatory").map((k) => SETTING_LABELS[k]);
      const parts = [req, rest.length ? `${rest.join(", ")} changed` : null].filter(Boolean);
      changes.push({ kind: "field_settings", text: `${name}: ${parts.join("; ")}` });
    }
  });
  b.forEach((prev, id) => {
    if (!a.has(id)) changes.push({ kind: "field_removed", text: `${nameOf(prev.field)} removed`, affectsData: true });
  });
  return changes;
}

/** A field whose index changed only because fields before it were added/removed is not "reordered". */
function sectionOrderOnly(
  prev: { section: FormSection; index: number },
  cur: { section: FormSection; index: number },
  b: Map<string, { section: FormSection; index: number }>,
  a: Map<string, { section: FormSection; index: number }>
): boolean {
  const order = (m: Map<string, { section: FormSection; index: number }>, sectionId: string) =>
    [...m.entries()].filter(([, v]) => v.section.id === sectionId).sort((x, y) => x[1].index - y[1].index).map(([id]) => id);
  const beforeIds = order(b, prev.section.id).filter((id) => a.has(id) && a.get(id)!.section.id === cur.section.id);
  const afterIds = order(a, cur.section.id).filter((id) => b.has(id) && b.get(id)!.section.id === prev.section.id);
  return JSON.stringify(beforeIds) === JSON.stringify(afterIds);
}

/** Short wording for a list of changes, e.g. “3 changes · 1 removes data”. */
export function summarizeChanges(changes: LayoutChange[]): string {
  if (changes.length === 0) return "No changes";
  const risky = changes.filter((c) => c.affectsData).length;
  return `${changes.length} change${changes.length === 1 ? "" : "s"}${risky ? ` · ${risky} hide${risky === 1 ? "s" : ""} saved values` : ""}`;
}
