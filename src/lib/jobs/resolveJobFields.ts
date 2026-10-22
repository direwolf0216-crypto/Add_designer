// Read-side resolution of a job for the details view: summary values guessed from the dynamic
// layout, financials, spec line items, the dynamic sections to list and the status timeline.
// Pure: no React.

import type { ValueLookup } from "@/lib/forms/visibility";
import { lineMultiplier, pricingRuleFor, type PricingRules, type PricingUnit } from "@/lib/jobs/pricing";
import type { FieldMap, FormField, FormLayout, FormSection } from "@/lib/forms/types";

/** A job as returned by /api/jobs/[id], with customData/inclusions parsed. */
export interface DetailsJob {
  id: string;
  jobNumber?: string | null;
  title?: string;
  phone?: string;
  email?: string;
  status?: string;
  category?: string;
  createdAt: string;
  client?: { name?: string; phone?: string; email?: string } | null;
  order?: { package?: number | string; advance?: number | string } | null;
  customData: Record<string, any>;
  inclusions: unknown[];
  [key: string]: any;
}

const parseJson = <T>(value: unknown, fallback: T): T => {
  try {
    return JSON.parse(value as string);
  } catch {
    return fallback;
  }
};

/** Parse the JSON-string columns the API may return. */
export function normalizeJob(fetched: Record<string, any>): DetailsJob {
  return {
    ...fetched,
    customData: typeof fetched.customData === "string" ? parseJson(fetched.customData, {}) : fetched.customData || {},
    inclusions: typeof fetched.inclusions === "string" ? parseJson(fetched.inclusions, []) : fetched.inclusions || [],
  } as DetailsJob;
}

/** A field's value from customData, falling back to the first entry of any repeatable section. */
export function getDynamicFieldValue(customData: Record<string, any> | null | undefined, fieldId: string, standardFieldName?: string) {
  if (!customData) return null;
  if (customData[fieldId]) return customData[fieldId];
  if (standardFieldName && customData[standardFieldName]) return customData[standardFieldName];

  for (const key of Object.keys(customData)) {
    if (key.startsWith("rep_")) {
      let arr = customData[key];
      if (typeof arr === "string") {
        try {
          arr = JSON.parse(arr);
        } catch {}
      }
      if (Array.isArray(arr) && arr.length > 0) {
        const firstItem = arr[0];
        if (firstItem[fieldId]) return firstItem[fieldId];
        if (standardFieldName && firstItem[standardFieldName]) return firstItem[standardFieldName];
      }
    }
  }
  return null;
}

/** Entries of a repeatable section stored in customData (JSON string or array). */
function repeatableEntries(customData: Record<string, any>, sectionId: string): any[] {
  const repData = customData?.["rep_" + sectionId];
  if (typeof repData === "string") return parseJson(repData, []);
  if (Array.isArray(repData)) return repData;
  return [];
}

const titleOf = (s: FormSection) => s.title?.toLowerCase();
const isJobDetailsSection = (s: FormSection) => titleOf(s) === "job details" || titleOf(s) === "job information";

export interface JobSummary {
  sizeVal: any;
  qtyVal: any;
  dueDateVal: any;
  /** Category text for the summary strip ("N/A" when unknown). */
  displayCategory: string;
}

/** Category, size, quantity and due date, from well-known keys first and then by layout field names. */
export function resolveJobSummary(job: DetailsJob, layout: FormLayout | null | undefined, fieldMap: FieldMap): JobSummary {
  const cd = job.customData;
  let sizeVal = cd?.size || cd?.fld_print_size;
  let qtyVal = cd?.qty || cd?.quantity || cd?.fld_print_quantity;
  let dueDateVal = cd?.due_date || cd?.dueDate || cd?.fld_b_due_date || cd?.job_delivery_date || cd?.delivery_date;
  let categoryVal = job.category || cd?.category || cd?.fld_b_job_category;

  if (layout?.sections) {
    const fields = layout.sections.flatMap((s) => s.fields || []);
    const lookup = (f: FormField) => getDynamicFieldValue(cd, f.id, fieldMap[f.id]);

    const catField = fields.find((f) => (f.name || "").toLowerCase().includes("category"));
    if (catField) categoryVal = lookup(catField) || categoryVal;

    if (!sizeVal) {
      const sizeField = fields.find((f) => f.name?.toLowerCase().includes("size"));
      if (sizeField) sizeVal = lookup(sizeField);
    }
    if (!qtyVal) {
      const qtyField = fields.find((f) => f.name?.toLowerCase() === "qty" || f.name?.toLowerCase() === "quantity");
      if (qtyField) qtyVal = lookup(qtyField);
    }
    if (!dueDateVal) {
      const dueDateField = fields.find((f) => f.name?.toLowerCase().includes("due date") || f.name?.toLowerCase().includes("delivery date"));
      if (dueDateField) dueDateVal = lookup(dueDateField);
    }
  }

  let displayCategory = "N/A";
  if (categoryVal) {
    if (Array.isArray(categoryVal)) {
      displayCategory = categoryVal.join(", ");
    } else if (typeof categoryVal === "string") {
      try {
        const parsed = JSON.parse(categoryVal);
        displayCategory = Array.isArray(parsed) ? parsed.join(", ") : categoryVal;
      } catch {
        displayCategory = categoryVal;
      }
    } else {
      displayCategory = String(categoryVal);
    }
  }

  // Repeatable line items: list each distinct category.
  const jdSec = layout?.sections?.find(isJobDetailsSection);
  if (jdSec && jdSec.isRepeatable) {
    let repData = cd?.["rep_" + jdSec.id];
    if (typeof repData === "string") repData = parseJson(repData, []);
    if (Array.isArray(repData)) {
      const catField = jdSec.fields?.find((f) => (f.name || "").toLowerCase().includes("category") || (f.name || "").toLowerCase().includes("type"));
      if (catField) {
        const categories = repData.map((item: any) => item[catField.id] || item[fieldMap[catField.id]]).filter((c: unknown) => c);
        if (categories.length > 0) displayCategory = Array.from(new Set(categories)).join(", ");
      }
    }
  }

  return { sizeVal, qtyVal, dueDateVal, displayCategory };
}

export interface JobFinancials {
  totalAmount: number;
  advanceAmount: number;
  dueAmount: number;
  paymentMethod: string;
}

export function resolveFinancials(job: DetailsJob): JobFinancials {
  const totalAmount = Number(job.order?.package || job.customData?.fld_b_package || 0);
  const advanceAmount = Number(job.order?.advance || job.customData?.fld_b_advance || 0);
  return {
    totalAmount,
    advanceAmount,
    dueAmount: totalAmount - advanceAmount,
    paymentMethod: job.customData?.paymentMode || job.customData?.fld_b_payment_mode || "Cash",
  };
}

export interface SpecEntry {
  category: any;
  size: any;
  quantity: any;
  /** Formatted rate ("₹ 1,200") or "N/A". */
  rateLabel: string;
  /** "sqft" when the category is priced per square foot (Settings → Pricing). */
  unit: PricingUnit;
  /** Area in sq ft parsed from the size, for per-sq-ft lines with a readable size. */
  area: number | null;
  /** The category's pricing unit has changed since this job was saved (edit and save to reprice). */
  repricedSince: boolean;
  /** rate × quantity, or null without a numeric rate. */
  total: number | null;
}

/** Line items for the "Job Details" card: repeatable entries of the job-details section, else the job itself. */
export function resolveSpecEntries(job: DetailsJob, layout: FormLayout | null | undefined, fieldMap: FieldMap, summary: JobSummary, rules: PricingRules = {}): SpecEntry[] {
  let entries: any[] = [job.customData];
  const jdSec = layout?.sections?.find(isJobDetailsSection);

  const financialRatesRaw = job.customData?.fld_financial_rates;
  let financialRates: Record<string, string> = {};
  if (typeof financialRatesRaw === "string") financialRates = parseJson(financialRatesRaw, {});
  else if (financialRatesRaw && typeof financialRatesRaw === "object") financialRates = financialRatesRaw;
  const unitsRaw = job.customData?.fld_financial_units;
  let savedUnits: Record<string, string> = {};
  if (typeof unitsRaw === "string") savedUnits = parseJson(unitsRaw, {});
  else if (unitsRaw && typeof unitsRaw === "object") savedUnits = unitsRaw;

  if (jdSec && jdSec.isRepeatable) entries = repeatableEntries(job.customData, jdSec.id);
  if (!entries || entries.length === 0) entries = [job.customData];

  return entries.map((entry: any, index: number) => {
    let sVal = entry?.size || entry?.fld_print_size;
    let qVal = entry?.qty || entry?.quantity || entry?.fld_print_quantity;
    let rVal = entry?.rate || entry?.fld_rate || entry?.price;
    let cVal = entry?.category || entry?.job_type;

    if (jdSec) {
      const allF = jdSec.fields || [];
      const valueOf = (f: FormField) => entry?.[f.id] || entry?.[fieldMap[f.id]];
      if (!sVal) {
        const sF = allF.find((f) => f.name?.toLowerCase().includes("size"));
        if (sF) sVal = valueOf(sF);
      }
      if (!qVal) {
        const qF = allF.find((f) => f.name?.toLowerCase() === "qty" || f.name?.toLowerCase() === "quantity");
        if (qF) qVal = valueOf(qF);
      }
      if (!rVal) {
        const rF = allF.find((f) => f.name?.toLowerCase().includes("rate") || f.name?.toLowerCase().includes("price"));
        if (rF) rVal = valueOf(rF);
      }
      if (!cVal) {
        const cF = allF.find((f) => f.name?.toLowerCase().includes("category") || f.name?.toLowerCase().includes("type"));
        if (cF) cVal = valueOf(cF);
      }
    }

    if (!rVal && jdSec && jdSec.isRepeatable) {
      const key = `rep_${jdSec.id}_${index}`;
      if (financialRates[key]) rVal = financialRates[key];
    }

    if (!sVal) sVal = summary.sizeVal;
    if (!qVal) qVal = summary.qtyVal;
    if (!rVal) rVal = "N/A";
    if (!cVal) cVal = summary.displayCategory && summary.displayCategory !== "N/A" ? summary.displayCategory : undefined;

    const hasValidRate = rVal !== "N/A" && !isNaN(parseFloat(String(rVal)));
    // Price the line the way it was priced when saved; jobs from before per-sq-ft pricing were per piece.
    const current = pricingRuleFor(rules, cVal).unit;
    const savedKey = jdSec && jdSec.isRepeatable ? `rep_${jdSec.id}_${index}` : "";
    const saved = savedUnits[savedKey];
    const unit: PricingUnit = saved === "sqft" || saved === "piece" ? saved : "piece";
    const { multiplier, area } = lineMultiplier(unit, qVal, sVal);
    const rateText = String(rVal).startsWith("₹") || rVal === "N/A" ? String(rVal) : `₹ ${parseFloat(String(rVal)).toLocaleString("en-IN")}`;
    return {
      category: cVal,
      size: sVal,
      quantity: qVal,
      rateLabel: unit === "sqft" && rVal !== "N/A" ? `${rateText} / sq ft` : rateText,
      total: hasValidRate ? (parseFloat(String(rVal)) || 0) * multiplier : null,
      unit,
      area,
      repricedSince: hasValidRate && current !== unit,
    };
  });
}

/** Sections covered by the fixed cards above; not repeated as dynamic sections. */
const FIXED_SECTION_TITLES = ["financials", "financial", "job information", "job info", "job details", "focus"];
/** Fields shown elsewhere (client card, summary strip, header) or not displayable as text. */
const HIDDEN_FIELD_NAMES = ["status", "date", "order date", "start time", "time", "category", "location", "focus", "due date", "job category"];

export interface DynamicSectionView {
  section: FormSection;
  /** Shown once (all fields of a regular section; `isRepeatableField: false` ones of a repeatable section). */
  globalFields: FormField[];
  /** Shown per entry of a repeatable section. */
  itemFields: FormField[];
  entries: any[];
}

/** Layout sections not covered by the fixed cards, with the fields worth listing. */
export function resolveDynamicSections(job: DetailsJob, layout: FormLayout | null | undefined): DynamicSectionView[] {
  const out: DynamicSectionView[] = [];
  layout?.sections
    ?.filter((s) => !FIXED_SECTION_TITLES.includes(titleOf(s) as string))
    .forEach((section) => {
      const visibleFields =
        section.fields?.filter((f) => {
          const fname = (f.name || "").toLowerCase();
          if (f.id === "fld_b_client" || f.id === "fld_b_phone" || f.id === "fld_b_email") return false;
          if (fname.includes("attachment") || f.type === "FILE" || f.type === "ATTACHMENT") return false;
          if (HIDDEN_FIELD_NAMES.includes(fname)) return false;
          return true;
        }) || [];
      if (visibleFields.length === 0) return;

      const entries = section.isRepeatable ? repeatableEntries(job.customData, section.id) : [job.customData];
      if (!entries || entries.length === 0) return;

      out.push({
        section,
        globalFields: section.isRepeatable ? visibleFields.filter((f) => f.isRepeatableField === false) : visibleFields,
        itemFields: section.isRepeatable ? visibleFields.filter((f) => f.isRepeatableField !== false) : [],
        entries,
      });
    });
  return out;
}

/** Value shown for a dynamic field: a first-class job column when mapped, else from `source` (customData or an entry). */
export function dynamicFieldValue(job: DetailsJob, field: FormField, fieldMap: FieldMap, source: Record<string, any> | undefined): unknown {
  const standardKey = fieldMap[field.id];
  return standardKey ? job[standardKey] : source?.[field.id];
}

/** Visibility lookup against a saved job: job columns first, then customData. */
export const jobValueLookup =
  (job: DetailsJob): ValueLookup =>
  (fieldName, fieldId) => {
    const standardDepVal = job[fieldName];
    return standardDepVal !== undefined && standardDepVal !== null && standardDepVal !== ""
      ? standardDepVal
      : job.customData?.[fieldName] || job.customData?.[fieldId];
  };

export interface StatusStep {
  label: string;
  value: string;
  icon: string;
  color?: string;
}

const DEFAULT_STEPS: StatusStep[] = [
  { label: "Pending", value: "Pending", icon: "ph-fill ph-clock", color: "text-red-500" },
  { label: "Designing", value: "Designing", icon: "ph-fill ph-paint-brush-broad" },
  { label: "Designing Completed", value: "Designing Completed", icon: "ph-fill ph-check-square-offset" },
  { label: "Printing in Progress", value: "Sent for printing", icon: "ph-fill ph-printer" },
  { label: "Ready for Delivery", value: "Ready for delivery", icon: "ph-fill ph-package" },
];

/** Timeline steps from the first STATUS_PICKER's options (icons/colours guessed from labels). */
export function buildStatusSteps(layout: FormLayout | null | undefined): StatusStep[] {
  const statusF = layout?.sections?.flatMap((s) => s.fields || []).find((f) => f.type === "STATUS_PICKER");
  if (!statusF || !statusF.statusOptions || statusF.statusOptions.length === 0) return DEFAULT_STEPS;

  return statusF.statusOptions.map((raw) => {
    // Options are `{ label, color }` objects, but older/default layouts may store plain strings.
    const opt = typeof raw === "string" ? { label: raw as string } : raw;
    const label = String(opt?.label ?? "");
    const lower = label.toLowerCase();
    let icon = "ph-fill ph-check-circle";
    let color = "text-slate-500";
    if (lower.includes("pending") || lower.includes("confirmed")) { icon = "ph-fill ph-clock"; color = "text-amber-500"; }
    else if (lower.includes("design") && lower.includes("complet")) { icon = "ph-fill ph-check-square-offset"; color = "text-violet-500"; }
    else if (lower.includes("design")) { icon = "ph-fill ph-paint-brush-broad"; color = "text-blue-500"; }
    else if (lower.includes("print")) { icon = "ph-fill ph-printer"; color = "text-fuchsia-500"; }
    else if (lower.includes("deliver") || lower.includes("dispatch")) { icon = "ph-fill ph-package"; color = "text-green-500"; }
    else if (lower.includes("cancel")) { icon = "ph-fill ph-x-circle"; color = "text-red-500"; }
    else if (lower.includes("completed") || lower.includes("done")) { icon = "ph-fill ph-check-circle"; color = "text-emerald-500"; }
    return { label, value: label, icon, color };
  });
}
