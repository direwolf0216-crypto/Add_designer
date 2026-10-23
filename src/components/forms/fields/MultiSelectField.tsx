import CustomMultiDropdown from "@/components/ui/CustomMultiDropdown";
import { optionLabels, splitMultiValue, withLegacyOptions } from "@/lib/forms/options";
import type { FieldProps } from "./types";

/** Multi-select stored as a comma-separated string. */
export default function MultiSelectField({ field, value, onChange, error, variant }: FieldProps) {
  const opts = field.options || [];
  const selectedArray = splitMultiValue(value || "");
  const join = (val: string[] | string) => onChange(Array.isArray(val) ? val.join(", ") : val);

  if (variant === "transaction") {
    return (
      <CustomMultiDropdown
        options={optionLabels(withLegacyOptions(opts, selectedArray))}
        value={selectedArray}
        onChange={join}
        error={!!error}
        placeholder={field.placeholder || `Select ${field.name}...`}
      />
    );
  }

  return (
    <CustomMultiDropdown
      options={optionLabels(opts)}
      value={selectedArray}
      onChange={join}
      error={!!error}
      placeholder={field.placeholder || `Select ${field.name}...`}
      className="pl-11"
    />
  );
}
