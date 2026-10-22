// Derive a job's production stage and due date from its form data. Pure and isomorphic.
//
// The job form stores layout fields either at the top level of customData or inside a repeatable
// section (customData.rep_<sectionId>, an array or a JSON string). The first line item is treated as
// the job's own values. Board stage changes write customData.fld_b_status at the top level, which wins.

import { calendarDateToUtc } from "@/lib/dates";
import { findRoleField } from "@/lib/forms/roles";

type LayoutField = { id: string; name?: string; label?: string; type?: string; isRecordDate?: boolean; role?: string };
type Layout = { sections?: { id?: string; isRepeatable?: boolean; fields?: LayoutField[] }[] } | null | undefined;

export const DEFAULT_STAGES = [
  { label: "Pending", color: "bg-red-500" },
  { label: "Designing", color: "bg-yellow-500" },
  { label: "Designing Completed", color: "bg-violet-500" },
  { label: "Printing", color: "bg-blue-500" },
  { label: "Ready for Delivery", color: "bg-emerald-500" },
  { label: "Delivered", color: "bg-slate-500" },
  { label: "Cancelled", color: "bg-gray-500" },
];
export type StageOption = { label: string; color: string };

const fieldsOf = (layout: Layout) => layout?.sections?.flatMap((s) => s.fields ?? []) ?? [];
const nameOf = (f: LayoutField) => (f.name || f.label || "").toLowerCase();

/** Board stages from the layout's status picker (configurable), else the defaults. */
export function stageOptions(layout: Layout): StageOption[] {
  const picker = fieldsOf(layout).find((f) => f.id === "fld_b_status" || f.type === "STATUS_PICKER") as
    | (LayoutField & { statusOptions?: { label?: string; color?: string }[] })
    | undefined;
  const opts = picker?.statusOptions?.filter((o) => o?.label).map((o) => ({ label: o.label as string, color: o.color || "bg-slate-400" }));
  return opts && opts.length ? opts : DEFAULT_STAGES;
}

/**
 * Whether the job's status column is the board stage itself: true when the layout's first STATUS_PICKER
 * is the stage picker (`fld_b_status`), as in the default form. Then status and stage are kept equal.
 */
export function statusIsStage(layout: Layout): boolean {
  const first = fieldsOf(layout).find((f) => f.type === "STATUS_PICKER");
  return !first || first.id === "fld_b_status";
}

/**
 * Keep `status` and the stage field (`fld_b_status`) in step when they are the same picker. A caller
 * that changed only one of them gets the other filled in; an explicit pair is left alone.
 */
export function syncStatusWithStage(
  layout: Layout,
  previous: { status: string | null; stage: string | null },
  next: { status?: string; customData: Record<string, unknown> }
): { status?: string; customData: Record<string, unknown> } {
  if (!statusIsStage(layout)) return next;
  const customData = { ...next.customData };
  const stages = stageOptions(layout).map((s) => s.label.toLowerCase());
  const stage = str(customData.fld_b_status);
  const stageChanged = stage !== null && stage !== (previous.stage ?? null);
  const statusChanged = next.status !== undefined && next.status !== (previous.status ?? null);
  if (stageChanged && !statusChanged) return { status: stage, customData };
  if (statusChanged && !stageChanged && next.status && stages.includes(next.status.toLowerCase())) {
    customData.fld_b_status = next.status;
    return { status: next.status, customData };
  }
  return { status: next.status, customData };
}

/** Layout id of the due/delivery date field, if the layout has one. */
export function dueDateFieldId(layout: Layout): string | null {
  const byRole = findRoleField(layout, "dueDate");
  if (byRole) return byRole.id;
  const f = fieldsOf(layout).find((x) => x.type === "DATE" && !x.isRecordDate && /due|deliver/.test(nameOf(x)));
  return f?.id ?? null;
}

function firstLineItem(customData: Record<string, unknown>): Record<string, unknown> | null {
  for (const [key, raw] of Object.entries(customData)) {
    if (!key.startsWith("rep_")) continue;
    let value: unknown = raw;
    if (typeof value === "string") {
      try {
        value = JSON.parse(value);
      } catch {
        continue;
      }
    }
    if (Array.isArray(value) && value[0] && typeof value[0] === "object") return value[0] as Record<string, unknown>;
  }
  return null;
}

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

/** Parse yyyy-MM-dd (or an ISO instant) to a UTC-midnight calendar date; null when absent/invalid. */
export function parseCalendarDate(value: unknown): Date | null {
  const s = str(value);
  if (!s) return null;
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(s);
  if (m) return calendarDateToUtc(m[1]);
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : calendarDateToUtc(d.toISOString().slice(0, 10));
}

export function deriveJobTracking(customData: unknown, layout: Layout): { stage: string | null; dueDate: Date | null } {
  const cd = customData && typeof customData === "object" && !Array.isArray(customData) ? (customData as Record<string, unknown>) : {};
  const item = firstLineItem(cd);
  const pickerId = fieldsOf(layout).find((f) => f.type === "STATUS_PICKER")?.id;

  const stage =
    str(cd.fld_b_status) ??
    (pickerId ? str(cd[pickerId]) : null) ??
    (item ? str(item.fld_b_status) ?? str(item.status) ?? (pickerId ? str(item[pickerId]) : null) : null);

  const dueId = dueDateFieldId(layout);
  const dueRaw =
    (dueId ? cd[dueId] ?? item?.[dueId] : undefined) ??
    cd.due_date ?? cd.dueDate ?? cd.fld_b_due_date ?? cd.delivery_date ??
    item?.due_date ?? item?.dueDate;

  return { stage, dueDate: parseCalendarDate(dueRaw) };
}
