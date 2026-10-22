import type { FieldAudience, FieldRole, FieldValidation, VisibilityCondition, VisibilityOperator } from "@/lib/forms/types";

export type { FieldAudience, FieldRole, FieldValidation, VisibilityCondition, VisibilityOperator };

export interface VisibilityRule {
  /** Legacy single condition. */
  fieldId?: string;
  operator?: VisibilityOperator;
  values?: string[];
  /** Newer rules: several conditions joined by `match` (default "all"). */
  match?: "all" | "any";
  conditions?: VisibilityCondition[];
}

export interface StatusOption {
  label: string;
  color: string;
}

export interface UserPicklistConfig {
  mode: "ALL" | "ROLES" | "USERS";
  roles?: string[];
  userIds?: string[];
  showAvailability?: boolean;
}

export interface FutureDateRestriction {
  enabled: boolean;
  dateFieldId: string;
  restrictedStatuses: string[];
}

export interface FormField {
  id: string;
  name: string;
  type: string; // 'SINGLE_LINE', 'MULTI_LINE', 'NUMBER', 'CURRENCY', 'DATE', 'PICK_LIST', 'MULTI_SELECT', 'CHECKBOX', 'FILE', 'IMAGE', 'USER_PICKLIST', 'MULTI_USER_PICKLIST', 'STATUS_PICKER', 'TIME', 'CATEGORY_PICKER'
  isRepeatableField?: boolean;
  mandatory: boolean;
  options?: string[];
  statusOptions?: StatusOption[];
  placeholder?: string;
  defaultValue?: string;
  userPicklistConfig?: UserPicklistConfig;
  /** SIZE fields: units offered by the picker (defaults to ft, in, cm, mm, m) and the one preselected. */
  sizeUnits?: string[];
  defaultUnit?: string;
  /** Hidden from new forms; values already saved under it stay readable in details, exports and reports. */
  archived?: boolean;
  visibilityRule?: VisibilityRule;
  /** Required only while this rule holds (in addition to `mandatory`). */
  mandatoryRule?: VisibilityRule;
  role?: FieldRole;
  validation?: FieldValidation;
  audience?: FieldAudience;
  futureDateRestriction?: FutureDateRestriction;
  restrictFutureDate?: boolean;
  isRecordDate?: boolean;
}

export interface FormSection {
  id: string;
  title: string;
  description?: string;
  icon?: string;
  fields: FormField[];
  locked?: boolean;
  visibilityRule?: VisibilityRule;
  isRepeatable?: boolean;
}

export interface FormSchema {
  sections: FormSection[];
}

export interface FormLayout {
  /** Set by the server: the live version number and when a draft was last saved. */
  publishedVersion?: number | null;
  draftUpdatedAt?: string | null;
  draftSchema?: FormSchema | null;
  id?: string;
  formKey: string;
  name: string;
  description: string;
  schema: FormSchema;
}

/** Where a field sits inside the active layout (used while dragging an existing field). */
export interface FieldPosition {
  sectionId: string;
  fieldIndex: number;
}
