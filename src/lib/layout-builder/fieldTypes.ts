export interface FieldTypeDef {
  value: string;
  label: string;
  icon: string;
}

export const FIELD_TYPES: FieldTypeDef[] = [
  { value: "SINGLE_LINE", label: "Single-Line", icon: "ph-text-t" },
  { value: "MULTI_LINE", label: "Multi-Line", icon: "ph-text-align-left" },
  { value: "PICK_LIST", label: "Pick List", icon: "ph-list-dashes" },
  { value: "STATUS_PICKER", label: "Status Picker", icon: "ph-palette" },
  { value: "MULTI_SELECT", label: "Multi Select", icon: "ph-list-checks" },
  { value: "DATE", label: "Date", icon: "ph-calendar-blank" },
  { value: "TIME", label: "Time", icon: "ph-clock" },
  { value: "CHECKBOX", label: "Checkbox", icon: "ph-check-square" },
  { value: "CURRENCY", label: "Currency", icon: "ph-currency-dollar" },
  { value: "PERCENTAGE", label: "% Percentage", icon: "ph-percent" },
  { value: "NUMBER", label: "Number", icon: "ph-hash" },
  { value: "DECIMAL", label: ".00 Decimal", icon: "ph-math-operations" },
  { value: "EMAIL", label: "Email", icon: "ph-envelope-simple" },
  { value: "PHONE", label: "Phone", icon: "ph-phone" },
  { value: "FILE", label: "Attachment", icon: "ph-paperclip" },
  { value: "USER_PICKLIST", label: "User (Single)", icon: "ph-user" },
  { value: "MULTI_USER_PICKLIST", label: "Users (Multiple)", icon: "ph-users" },
];

export const getFieldTypeDef = (type: string | undefined): FieldTypeDef | undefined =>
  FIELD_TYPES.find((t) => t.value === type);

/** Section that ships with the Job form and can't be edited, reordered or deleted. */
export const LOCKED_SECTION_ID = "sec_job_financial";

/** The transaction type field: INCOME / EXPENSE drive every financial report and are a database enum. */
export const FIXED_OPTIONS_FIELD_ID = "fld_tx_type";
