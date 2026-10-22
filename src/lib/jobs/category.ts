/**
 * A job's category from its form data. The category pick-list normally sits at the top level
 * (`fld_b_job_category`), but when the admin makes "Job Details" a repeatable section its fields live in
 * rows under `rep_<sectionId>` (an array, or a JSON string of one), keyed by the mapped name `category`
 * or by the field id; the first row's pick then names the job.
 */
export function categoryFromCustomData(customData: unknown, roleFieldId?: string | null): string {
  const data = parseObject(customData);
  if (!data) return "";
  const top = pick(data, roleFieldId);
  if (top) return top;
  for (const [key, raw] of Object.entries(data)) {
    if (!key.startsWith("rep_")) continue;
    const rows = Array.isArray(raw) ? raw : typeof raw === "string" ? safeParse(raw) : null;
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      const v = pick(parseObject(row), roleFieldId);
      if (v) return v;
    }
  }
  return "";
}

function pick(row: Record<string, unknown> | null, roleFieldId?: string | null): string {
  if (!row) return "";
  for (const k of [roleFieldId, "fld_b_job_category", "category", "fld_b_category"]) {
    if (!k) continue;
    const v = row[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

function parseObject(value: unknown): Record<string, unknown> | null {
  const v = typeof value === "string" ? safeParse(value) : value;
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
