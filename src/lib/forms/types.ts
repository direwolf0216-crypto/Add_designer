// Shapes of the dynamic form layouts stored under /api/settings/layouts/<FORM_KEY> (JOB_FORM,
// TRANSACTION_FORM, ...). Layouts are user-edited JSON, so every property except `id` is optional
// in practice; the types document what the renderers read, not what the builder guarantees.

export type VisibilityOperator = "EQUALS" | "NOT_EQUALS" | "CONTAINS";

/**
 * Show a section/field only when another field has (or lacks) a value.
 * Two historical formats exist: `{ fieldId, operator, value }` and `{ dependsOn, values }`.
 */
export interface VisibilityRule {
  dependsOn?: string;
  fieldId?: string;
  operator?: VisibilityOperator | string;
  values?: string[];
  value?: string;
}

/** Pick-list options are plain strings in older layouts and `{ label, value }` objects in newer ones. */
export type FieldOption = string | { label?: string; value?: string; color?: string };

export interface StatusOption {
  label: string;
  color?: string;
}

export interface UserPicklistConfig {
  mode?: "ROLES" | "USERS" | string;
  roles?: string[];
  userIds?: string[];
  showAvailability?: boolean;
}

export interface FutureDateRestriction {
  enabled?: boolean;
  /** Field whose date decides whether the restriction applies. */
  dateFieldId?: string;
  /** Status labels that cannot be picked while that date is in the future. */
  restrictedStatuses?: string[];
}

export type FieldType =
  | "SINGLE_LINE"
  | "MULTI_LINE"
  | "EMAIL"
  | "PHONE"
  | "NUMBER"
  | "SIZE"
  | "CURRENCY"
  | "DATE"
  | "TIME"
  | "PICK_LIST"
  | "MULTI_PICKLIST"
  | "MULTI_SELECT"
  | "CATEGORY_PICKER"
  | "STATUS_PICKER"
  | "USER_PICKLIST"
  | "MULTI_USER_PICKLIST"
  | "CHECKBOX"
  | "IMAGE"
  | "FILE";

export interface FormField {
  id: string;
  name: string;
  type: FieldType | string;
  mandatory?: boolean;
  placeholder?: string;
  options?: FieldOption[];
  statusOptions?: StatusOption[];
  defaultValue?: unknown;
  visibilityRule?: VisibilityRule | null;
  /** Inside a repeatable section: `false` marks a field shown once for the whole section. */
  isRepeatableField?: boolean;
  /** The field whose value is sent as the record's `recordDate`. */
  isRecordDate?: boolean;
  restrictFutureDate?: boolean;
  futureDateRestriction?: FutureDateRestriction;
  userPicklistConfig?: UserPicklistConfig;
  /** SIZE fields: units offered by the picker (defaults to ft, in, cm, mm, m) and the one preselected. */
  sizeUnits?: string[];
  defaultUnit?: string;
}

export interface FormSection {
  id: string;
  title?: string;
  description?: string;
  icon?: string;
  isRepeatable?: boolean;
  visibilityRule?: VisibilityRule | null;
  fields: FormField[];
}

export interface FormLayout {
  sections: FormSection[];
}

/** Layout field id → form value key (e.g. `fld_b_client` → `title`). Unmapped ids are used as-is. */
export type FieldMap = Readonly<Record<string, string>>;

/** Values of one repeatable-section entry, keyed by form value key. */
export type RepeatableEntry = Record<string, any>;

/** All repeatable sections' entries, keyed `rep_<sectionId>`. */
export type RepeatableData = Record<string, RepeatableEntry[]>;
