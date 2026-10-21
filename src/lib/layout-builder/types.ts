export type VisibilityOperator = "EQUALS" | "NOT_EQUALS" | "CONTAINS";

export interface VisibilityRule {
  fieldId: string;
  operator: VisibilityOperator;
  values?: string[];
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
  visibilityRule?: VisibilityRule;
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
