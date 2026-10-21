// Pure display derivations for a Job Status board row / detail panel. No React imports.
import type { JobCustomData, StatusBoardJob } from "./statusCounts";

const DATE_FORMAT: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short", year: "numeric" };

/** "05 Mar 2026"-style label, as the board renders dates. */
export function formatBoardDate(value: string | number | Date): string {
  return new Date(value).toLocaleDateString("en-GB", DATE_FORMAT);
}

/** The job's order date (date part only) formatted for display, or "-". */
export function formatJobOrderDate(date: StatusBoardJob["date"]): string {
  const bDate = date instanceof Date ? date.toISOString().split("T")[0] : date?.split("T")[0];
  return bDate ? formatBoardDate(bDate) : "-";
}

/** Job number, falling back to a short id-based reference. */
export function jobDisplayNumber(job: Pick<StatusBoardJob, "id" | "jobNumber">): string {
  return job.jobNumber || `BK-${job.id.substring(job.id.length - 4).toUpperCase()}`;
}

interface LayoutField {
  id: string;
  name: string;
  isRecordDate?: boolean;
}

export interface JobLayoutSchema {
  sections?: { fields: LayoutField[] }[];
}

export interface JobRowFields {
  deliveryDateStr: string | undefined;
  formattedDeliveryDate: string;
  category: string;
  size: string | null;
  qty: string | null;
}

/**
 * Resolve due date / category / size / qty for a row: well-known keys first, then fields the job
 * layout names "category" / "due|delivery|date" / "size" / "qty|quantity", then any matching
 * customData key, then any matching key on the first line item.
 */
export function resolveJobRowFields(
  job: StatusBoardJob,
  cData: JobCustomData,
  layoutSchema: JobLayoutSchema | null | undefined,
): JobRowFields {
  const firstRepItem: Record<string, any> | null = Array.isArray(job.items) ? job.items[0] : null;

  let deliveryDateStr = cData.due_date || cData.dueDate || cData.fld_b_due_date || cData.delivery_date;
  let resolvedCategory = cData.category || cData.fld_job_category || cData.fld_b_job_category || null;
  let resolvedSize = cData.size || cData.fld_print_size || firstRepItem?.size || firstRepItem?.fld_print_size || null;
  let resolvedQty =
    cData.qty ||
    cData.quantity ||
    cData.fld_print_quantity ||
    firstRepItem?.qty ||
    firstRepItem?.quantity ||
    firstRepItem?.fld_print_quantity ||
    null;

  // Use layout schema to precisely identify dynamic fields by their real names
  if (layoutSchema?.sections) {
    layoutSchema.sections.forEach((sec) => {
      sec.fields.forEach((f) => {
        const fname = f.name.toLowerCase();
        const fid = f.id;

        if (!resolvedCategory && fname.includes("category")) {
          resolvedCategory = cData[fid];
        }
        if (!deliveryDateStr && (fname.includes("due") || fname.includes("delivery") || (fname.includes("date") && !f.isRecordDate))) {
          deliveryDateStr = cData[fid];
        }
        if (!resolvedSize && fname.includes("size")) {
          resolvedSize = cData[fid] || firstRepItem?.[fid];
        }
        if (!resolvedQty && (fname.includes("qty") || fname.includes("quantity"))) {
          resolvedQty = cData[fid] || firstRepItem?.[fid];
        }
      });
    });
  }

  // Fallback logic for extraction without schema
  if (!deliveryDateStr) {
    for (const [k, v] of Object.entries(cData)) {
      const kLow = k.toLowerCase();
      if (kLow.includes("due") || kLow.includes("delivery")) {
        deliveryDateStr = v as string;
        break;
      }
    }
  }
  const formattedDeliveryDate = deliveryDateStr ? formatBoardDate(deliveryDateStr) : "Not set";

  if (!resolvedSize || !resolvedQty || !resolvedCategory) {
    for (const [k, v] of Object.entries(cData)) {
      const kLow = k.toLowerCase();
      if (!resolvedSize && kLow.includes("size")) resolvedSize = v as string;
      if (!resolvedQty && (kLow.includes("qty") || kLow.includes("quantity"))) resolvedQty = v as string;
      if (!resolvedCategory && kLow.includes("category")) resolvedCategory = v as string;
    }
  }
  if (firstRepItem && (!resolvedSize || !resolvedQty)) {
    for (const [k, v] of Object.entries(firstRepItem)) {
      const kLow = k.toLowerCase();
      if (!resolvedSize && kLow.includes("size")) resolvedSize = v as string;
      if (!resolvedQty && (kLow.includes("qty") || kLow.includes("quantity"))) resolvedQty = v as string;
    }
  }

  return {
    deliveryDateStr,
    formattedDeliveryDate,
    category: resolvedCategory || job.category || "-",
    size: resolvedSize,
    qty: resolvedQty,
  };
}

/** Whole days a not-yet-delivered job is past its delivery date, or null when it isn't overdue. */
export function overdueDays(deliveryDateStr: string | undefined, statusLabel: string, now: Date = new Date()): number | null {
  if (!deliveryDateStr) return null;
  if (!(new Date(deliveryDateStr) < now) || statusLabel.toLowerCase() === "delivered") return null;
  return Math.floor((now.getTime() - new Date(deliveryDateStr).getTime()) / (1000 * 3600 * 24));
}

export interface RowStatusStyle {
  bg: string;
  text: string;
  dot: string;
}

/** Status pill classes in the table. */
export function getRowStatusStyle(statusLabel: string): RowStatusStyle {
  const s = statusLabel.toLowerCase();
  if (s === "pending") return { bg: "bg-orange-100", text: "text-slate-800", dot: "bg-orange-500" };
  if (s === "designing") return { bg: "bg-purple-100", text: "text-slate-800", dot: "bg-purple-500" };
  if (s === "printing") return { bg: "bg-blue-100", text: "text-slate-800", dot: "bg-blue-500" };
  if (s === "ready for delivery" || s === "ready") return { bg: "bg-emerald-100", text: "text-slate-800", dot: "bg-emerald-500" };
  if (s === "delivered") return { bg: "bg-slate-100", text: "text-slate-800", dot: "bg-slate-500" };
  return { bg: "bg-slate-100", text: "text-slate-700", dot: "bg-slate-400" };
}

export interface DetailStatusStyle {
  color: string;
  /** 0–100; falls back to the stage's default when job_progress is 0/unset. */
  progress: number;
}

/** Status badge classes + timeline progress in the detail panel. */
export function getDetailStatusStyle(statusLabel: string, jobProgress: unknown): DetailStatusStyle {
  let color = "bg-slate-100 text-slate-700";
  let progress = parseInt((jobProgress as string) || "0");
  const s = statusLabel.toLowerCase();
  if (s === "designing") {
    color = "bg-orange-100 text-orange-700";
    if (progress === 0) progress = 25;
  } else if (s === "printing") {
    color = "bg-purple-100 text-purple-700";
    if (progress === 0) progress = 50;
  } else if (s === "ready for delivery") {
    color = "bg-emerald-100 text-emerald-700";
    if (progress === 0) progress = 75;
  } else if (s === "delivered") {
    color = "bg-blue-100 text-blue-700";
    if (progress === 0) progress = 100;
  }
  return { color, progress };
}
