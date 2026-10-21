import type { FormField, FormLayout } from "@/lib/layout-builder/types";

/** Common props for the small editors inside the properties panel. */
export interface FieldEditorProps {
  field: FormField;
  layout: FormLayout;
  onChange: (updates: Partial<FormField>) => void;
}
