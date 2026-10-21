import type { ReactNode } from "react";
import { getFieldIcon } from "@/lib/forms/fieldIcon";
import { resolveFieldKind, type FieldKind } from "@/lib/forms/fieldKind";
import CheckboxField from "./fields/CheckboxField";
import CurrencyField from "./fields/CurrencyField";
import DateField from "./fields/DateField";
import { FieldShell, IconWrap } from "./fields/FieldChrome";
import FileField from "./fields/FileField";
import MultiSelectField from "./fields/MultiSelectField";
import PickListField from "./fields/PickListField";
import ReadOnlyField from "./fields/ReadOnlyField";
import StatusField from "./fields/StatusField";
import TextAreaField from "./fields/TextAreaField";
import TextField from "./fields/TextField";
import TimeField from "./fields/TimeField";
import UserField from "./fields/UserField";
import type { FieldProps } from "./fields/types";

export type { FieldProps, FieldRenderContext } from "./fields/types";

export interface FieldRendererProps extends FieldProps {
  /** Render the value as a label/value row instead of an input (details views). */
  readOnly?: boolean;
}

function renderControl(kind: FieldKind, props: FieldProps): ReactNode {
  switch (kind) {
    case "date":
      return <DateField {...props} />;
    case "time":
      return <TimeField {...props} />;
    case "pickList":
      return <PickListField {...props} />;
    case "multiSelect":
      return <MultiSelectField {...props} />;
    case "status":
      return <StatusField {...props} />;
    case "user":
      return <UserField {...props} multiple={false} />;
    case "multiUser":
      return <UserField {...props} multiple />;
    case "textarea":
      return <TextAreaField {...props} />;
    case "checkbox":
      return <CheckboxField {...props} />;
    case "file":
      return <FileField {...props} />;
    case "currency":
      return <CurrencyField {...props} />;
    default:
      return <TextField {...props} />;
  }
}

const TRANSACTION_SHELL_CLASS: Partial<Record<FieldKind, string>> = {
  textarea: "col-span-full",
  status: "relative custom-dropdown-container",
  file: "flex flex-col gap-2",
};

/**
 * Renders one dynamic-layout field for the given form variant (see `FieldVariant`). The field type
 * decides the control via `resolveFieldKind`; the variant decides its styling and chrome:
 * job variants wrap controls with an icon (the caller renders the label), the transaction variant
 * wraps them with its own label and error message.
 */
export default function FieldRenderer({ readOnly, ...props }: FieldRendererProps) {
  const { field, variant } = props;
  if (readOnly) return <ReadOnlyField label={field.name} value={props.value} />;

  const kind = resolveFieldKind(field, variant);
  const control = renderControl(kind, props);

  if (variant === "transaction") {
    if (kind === "checkbox") return control;
    return (
      <FieldShell
        label={field.name}
        mandatory={field.mandatory}
        errorMessage={props.errorMessage}
        className={TRANSACTION_SHELL_CLASS[kind]}
        compactLabel={kind === "file"}
        after={props.children}
      >
        {control}
      </FieldShell>
    );
  }

  if (kind === "checkbox" || kind === "file") return control;
  return (
    <IconWrap icon={getFieldIcon(field.name, field.type)} hideIcon={kind === "currency"}>
      {control}
    </IconWrap>
  );
}
