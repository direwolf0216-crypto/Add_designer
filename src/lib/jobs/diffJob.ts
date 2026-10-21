// Field-level diff for the job activity stream. Pure (no DB, no React) so it can be unit-tested.

export type FieldChange = { field: string; label: string; from: string | null; to: string | null };

export type JobSnapshot = {
  category?: string | null;
  date?: Date | string | null;
  time?: string | null;
  location?: string | null;
  status?: string | null;
  notes?: string | null;
  packageName?: string | null;
  clientName?: string | null;
  clientPhone?: string | null;
  clientEmail?: string | null;
  packageAmount?: number | null;
  customData?: Record<string, unknown> | null;
};

const STANDARD_LABELS: Record<string, string> = {
  clientName: "Client",
  clientPhone: "Phone",
  clientEmail: "Email",
  category: "Job category",
  date: "Job date",
  time: "Time",
  location: "Location",
  status: "Status",
  notes: "Notes",
  packageName: "Package",
  packageAmount: "Total amount",
};

// customData keys that are bookkeeping, not user-entered fields.
const HIDDEN_CUSTOM_KEYS = new Set(["fld_financial_rates", "installments"]);

function display(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : value.toFixed(2);
  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) return value.slice(0, 10);
    return value.length > 200 ? `${value.slice(0, 197)}…` : value;
  }
  if (Array.isArray(value)) return value.length === 0 ? null : `${value.length} item${value.length === 1 ? "" : "s"}`;
  return "updated";
}

/**
 * Compare two snapshots. `fieldLabels` maps layout field ids (e.g. `field_1785…`) to their labels so the
 * stream reads "Due date" rather than an id.
 */
export function diffJob(before: JobSnapshot, after: JobSnapshot, fieldLabels: Record<string, string> = {}): FieldChange[] {
  const changes: FieldChange[] = [];
  for (const key of Object.keys(STANDARD_LABELS) as (keyof JobSnapshot)[]) {
    if (!(key in after)) continue;
    const from = display(before[key]);
    const to = display(after[key]);
    if (from !== to) changes.push({ field: key, label: STANDARD_LABELS[key], from, to });
  }

  const beforeCd = before.customData ?? {};
  const afterCd = after.customData ?? {};
  const keys = new Set([...Object.keys(beforeCd), ...Object.keys(afterCd)]);
  for (const key of keys) {
    if (HIDDEN_CUSTOM_KEYS.has(key) || key.startsWith("$")) continue;
    const from = display(beforeCd[key]);
    const to = display(afterCd[key]);
    if (from === to) continue;
    const label = fieldLabels[key] ?? (key.startsWith("rep_") ? "Line items" : humanize(key));
    changes.push({ field: key, label, from, to });
  }
  return changes;
}

function humanize(key: string): string {
  return key
    .replace(/^fld_(b_|tx_)?/, "")
    .replace(/_/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase());
}

/** One-line summary such as "Changed Status, Due date and 2 more". */
export function summarizeChanges(changes: FieldChange[]): string {
  if (changes.length === 0) return "Saved without changes";
  const names = changes.map((c) => c.label);
  if (names.length <= 2) return `Changed ${names.join(" and ")}`;
  return `Changed ${names.slice(0, 2).join(", ")} and ${names.length - 2} more`;
}

/** Map of layout field id → label from a FormLayout schema ({ sections: [{ fields: [{ id, name|label }] }] }). */
export function layoutFieldLabels(schema: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  const sections = (schema as { sections?: { fields?: { id?: string; name?: string; label?: string }[] }[] } | null)?.sections;
  for (const section of sections ?? []) {
    for (const f of section.fields ?? []) {
      if (f.id) out[f.id] = f.name || f.label || f.id;
    }
  }
  return out;
}
