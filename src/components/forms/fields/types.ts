import type { ReactNode } from "react";
import type { UseFormRegisterReturn } from "react-hook-form";
import type { FieldVariant } from "@/lib/forms/fieldKind";
import type { FormField } from "@/lib/forms/types";
import type { UserItem } from "@/components/ui/MultiUserPicklist";

/** Data some field types need beyond their own value. */
export interface FieldRenderContext {
  /** Users offered by USER_PICKLIST / MULTI_USER_PICKLIST fields (job form). */
  users?: UserItem[];
  /** Google Drive connection, for IMAGE / FILE fields. */
  driveStatus?: { connected: boolean };
  /** Drive folder module for uploads ("Jobs", "Transactions"). */
  moduleName?: string;
  /** Drive sub-folder for uploads, usually the record's category. */
  categoryName?: string;
  /** Current value of another field by form key (STATUS_PICKER future-date restriction). */
  getValue?: (name: string) => unknown;
  /** Maps layout ids referenced by a field's config to form keys. */
  fieldNameFor?: (fieldId: string) => string;
}

export interface FieldProps {
  field: FormField;
  /** Form value key the field reads/writes. */
  name: string;
  value: unknown;
  onChange: (value: any) => void;
  /**
   * react-hook-form registration. When given, native inputs (text, textarea, checkbox) are
   * uncontrolled and owned by the form; `value`/`onChange` are then ignored for them.
   */
  register?: UseFormRegisterReturn;
  error?: boolean;
  /** Message shown under the field by variants that render their own error (transaction). */
  errorMessage?: string;
  variant: FieldVariant;
  context?: FieldRenderContext;
  /** Extra content rendered inside the field wrapper, after the control (transaction variant). */
  children?: ReactNode;
}

export const asText = (value: unknown): string => (value as string) || "";
