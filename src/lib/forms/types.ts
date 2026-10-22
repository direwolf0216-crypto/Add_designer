// Shapes of the dynamic form layouts stored under /api/settings/layouts/<FORM_KEY> (JOB_FORM,
// TRANSACTION_FORM, ...). Layouts are user-edited JSON, so every property except `id` is optional
// in practice; the types document what the renderers read, not what the builder guarantees.

export type VisibilityOperator =
  | "EQUALS"
  | "NOT_EQUALS"
  | "CONTAINS"
  | "IS_EMPTY"
  | "IS_NOT_EMPTY"
  | "GREATER_THAN"
  | "LESS_THAN"
  | "BEFORE"
  | "AFTER";

/** One test inside a rule: the value of `fieldId` compared with `values`. */
export interface VisibilityCondition {
  fieldId: string;
  operator: VisibilityOperator | string;
  values?: string[];
}

/**
 * What a field means to the rest of the app (pricing, the board, exports). Roles replace guessing from
 * labels, so a field can be called anything.
 */
export type FieldRole =
  | "customer"
  | "phone"
  | "email"
  | "orderDate"
  | "dueDate"
  | "category"
  | "size"
  | "quantity"
  | "status"
  | "total"
  | "advance"
  | "discount";

/** Input checks beyond "required"; `message` overrides the default wording. */
export interface FieldValidation {
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: "phone" | "email" | "pincode" | "gstin" | "custom";
  regex?: string;
  message?: string;
}

/**
 * Show a section/field only when another field has (or lacks) a value.
 * Two historical formats exist: `{ fieldId, operator, value }` and `{ dependsOn, values }`.
 */
/**
 * When a field or section shows (or, as `mandatoryRule`, when it is required). Newer rules hold
 * `conditions` joined by `match`; older ones are a single `fieldId` / `operator` / `values`.
 */
export interface VisibilityRule {
  dependsOn?: string;
  fieldId?: string;
  operator?: VisibilityOperator | string;
  values?: string[];
  value?: string;
  match?: "all" | "any";
  conditions?: VisibilityCondition[];
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
  /** Required only while this rule holds (in addition to `mandatory`). */
  mandatoryRule?: VisibilityRule | null;
  role?: FieldRole;
  validation?: FieldValidation;
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
  /** Hidden from new forms; values already saved under it stay readable in details, exports and reports. */
  archived?: boolean;
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
