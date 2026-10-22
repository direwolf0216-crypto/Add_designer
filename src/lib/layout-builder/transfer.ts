// Export / import of a layout as a JSON file.
import type { FormLayout, FormSchema } from "./types";

export const TRANSFER_KIND = "adddesigner-layout";

export interface LayoutTransfer {
  kind: typeof TRANSFER_KIND;
  version: 1;
  formKey: string;
  name: string;
  description?: string;
  exportedAt: string;
  schema: FormSchema;
}

export function serializeLayout(layout: FormLayout, now: Date = new Date()): string {
  const payload: LayoutTransfer = {
    kind: TRANSFER_KIND,
    version: 1,
    formKey: layout.formKey,
    name: layout.name,
    description: layout.description,
    exportedAt: now.toISOString(),
    schema: layout.schema,
  };
  return JSON.stringify(payload, null, 2);
}

export const exportFileName = (layout: FormLayout, now: Date = new Date()) =>
  `${layout.formKey.toLowerCase()}-layout-${now.toISOString().slice(0, 10)}.json`;

/** Parses an exported file (or a bare layout / schema) into a schema, or explains why it cannot be used. */
export function parseLayoutFile(text: string): { ok: true; formKey: string | null; name: string | null; schema: FormSchema } | { ok: false; error: string } {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: "That file is not valid JSON." };
  }
  if (!data || typeof data !== "object") return { ok: false, error: "That file does not contain a layout." };
  const obj = data as Record<string, unknown>;
  const schema = (obj.schema ?? (Array.isArray(obj.sections) ? obj : null)) as FormSchema | null;
  if (!schema || !Array.isArray(schema.sections)) return { ok: false, error: "No sections found. Export a layout from Layouts & Fields and import that file." };
  const ids = new Set<string>();
  for (const [i, s] of schema.sections.entries()) {
    if (!s || typeof s.id !== "string" || !Array.isArray(s.fields)) return { ok: false, error: `Section ${i + 1} is missing an id or its fields.` };
    for (const f of s.fields) {
      if (!f || typeof f.id !== "string" || typeof f.type !== "string") return { ok: false, error: `A field in “${s.title || s.id}” is missing an id or type.` };
      if (ids.has(f.id)) return { ok: false, error: `Field id “${f.id}” appears twice.` };
      ids.add(f.id);
    }
  }
  return { ok: true, formKey: typeof obj.formKey === "string" ? obj.formKey : null, name: typeof obj.name === "string" ? obj.name : null, schema };
}
