import CustomDropdown from "@/components/ui/CustomDropdown";
import { availableStatusOptions } from "@/lib/forms/options";
import { asText, type FieldProps } from "./types";

export default function StatusField({ field, value, onChange, error, variant, context }: FieldProps) {
  if (variant === "transaction") {
    const opts = field.statusOptions || [];
    return (
      <CustomDropdown
        options={opts.map((opt) => ({ label: opt.label, value: opt.label, color: opt.color }))}
        value={asText(value) || (opts.length > 0 ? opts[0].label : "")}
        onChange={onChange}
        error={!!error}
        placeholder={field.placeholder || "Select Status..."}
      />
    );
  }

  // Restricted statuses are omitted (not disabled) while the linked date is in the future.
  const dateFieldId = field.futureDateRestriction?.dateFieldId;
  const dependentDate =
    field.futureDateRestriction?.enabled && dateFieldId
      ? context?.getValue?.(context.fieldNameFor ? context.fieldNameFor(dateFieldId) : dateFieldId)
      : undefined;
  const availableOpts = availableStatusOptions(field, dependentDate);

  return (
    <CustomDropdown
      options={availableOpts.map((opt) => ({ label: opt.label, value: opt.label, color: opt.color }))}
      value={asText(value)}
      onChange={(val) => onChange(val)}
      error={!!error}
      placeholder={field.placeholder || "Select Status..."}
      className="pl-10"
    />
  );
}
