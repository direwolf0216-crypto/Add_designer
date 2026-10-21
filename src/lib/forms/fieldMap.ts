import type { FieldMap, FormField, FormLayout } from "./types";

// Layout field ids that are stored in first-class record columns rather than in customData.
// The job form and the job details view historically used slightly different maps; they are kept
// separate (and pinned by tests) so neither changes behaviour.

/** Job form (create/edit). */
export const JOB_FORM_FIELD_MAP: FieldMap = {
  fld_b_client: "title",
  fld_b_phone: "phone",
  fld_b_email: "email",
  fld_b_date: "date",
  fld_b_time: "time",
  fld_b_job_category: "category",
  fld_b_location: "location",
  fld_b_status: "status",
  fld_b_package: "package",
  fld_b_advance: "advance",
  fld_proof_delivered: "proofDelivered",
};

/** Job details view: also understands the legacy `fld_b_category` id. */
export const JOB_DETAILS_FIELD_MAP: FieldMap = {
  ...JOB_FORM_FIELD_MAP,
  fld_b_category: "category",
};

/** Transaction form. */
export const TRANSACTION_FIELD_MAP: FieldMap = {
  fld_tx_amount: "amount",
  fld_tx_type: "type",
  fld_tx_date: "date",
  fld_tx_category: "category",
  fld_tx_mode: "paymentMode",
  fld_tx_desc: "description",
};

/** Form value key for a layout field id. */
export function fieldNameFor(map: FieldMap, fieldId: string): string {
  return map[fieldId] || fieldId;
}

/** Every field of every section, in layout order. */
export function allFields(layout: FormLayout | null | undefined): FormField[] {
  return layout?.sections?.flatMap((s) => s.fields || []) ?? [];
}
