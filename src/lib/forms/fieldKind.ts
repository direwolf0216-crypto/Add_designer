import type { FormField } from "./types";

/**
 * Visual style of a rendered field:
 * - `job`: job form, icon-prefixed inputs, label rendered by the caller (react-hook-form state).
 * - `jobRepeatable`: one entry of a repeatable job section (plain controlled state, fewer types).
 * - `transaction`: transaction form, label and error rendered inside the field.
 */
export type FieldVariant = "job" | "jobRepeatable" | "transaction";

export type FieldKind =
  | "date"
  | "time"
  | "pickList"
  | "multiSelect"
  | "status"
  | "user"
  | "multiUser"
  | "textarea"
  | "checkbox"
  | "file"
  | "currency"
  | "size"
  | "text";

const isDiscountName = (field: FormField) => !!field.name && field.name.toLowerCase().includes("discount");

/**
 * Which input a field renders as. Each form supports a different subset of field types; anything
 * unsupported falls back to a text input, exactly as the original per-form renderers did.
 */
export function resolveFieldKind(field: FormField, variant: FieldVariant): FieldKind {
  const t = field.type;
  // Size (dimensions + unit, see `SizeField`) renders the same way on every form.
  if (t === "SIZE" || field.role === "size") return "size";

  if (variant === "jobRepeatable") {
    if (t === "DATE") return "date";
    if (t === "TIME") return "time";
    if (t === "PICK_LIST" || t === "CATEGORY_PICKER") return "pickList";
    if (t === "MULTI_SELECT") return "multiSelect";
    if (t === "CURRENCY" || field.role === "discount" || isDiscountName(field)) return "currency";
    return "text";
  }

  if (t === "DATE") return "date";
  if (t === "PICK_LIST") return "pickList";
  if (t === "MULTI_SELECT") return "multiSelect";
  if (t === "STATUS_PICKER") return "status";
  if (t === "MULTI_LINE") return "textarea";
  if (t === "CHECKBOX") return "checkbox";
  if (t === "IMAGE" || t === "FILE") return "file";

  if (variant === "job") {
    if (t === "TIME") return "time";
    if (t === "USER_PICKLIST") return "user";
    if (t === "MULTI_USER_PICKLIST") return "multiUser";
  }

  return "text";
}
