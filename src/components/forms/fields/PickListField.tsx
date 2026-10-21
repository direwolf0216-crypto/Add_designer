import type { ComponentProps } from "react";
import CustomDropdown from "@/components/ui/CustomDropdown";
import { asText, type FieldProps } from "./types";

type DropdownOptions = ComponentProps<typeof CustomDropdown>["options"];

export default function PickListField({ field, value, onChange, error, variant }: FieldProps) {
  const opts = field.options || [];

  if (variant === "transaction") {
    // Keep a value that is no longer one of the layout's options selectable.
    const options = opts.map((o) => o as string);
    if (value && !opts.includes(value as string)) options.push(value as string);
    return (
      <CustomDropdown
        options={options}
        value={asText(value)}
        onChange={onChange}
        error={!!error}
        placeholder={`Select ${field.name}...`}
      />
    );
  }

  return (
    <CustomDropdown
      options={opts as DropdownOptions}
      value={asText(value)}
      onChange={(val) => onChange(val)}
      error={!!error}
      placeholder={`Select ${field.name}...`}
      className="pl-10"
    />
  );
}
