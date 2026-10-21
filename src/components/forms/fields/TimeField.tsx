import TimePickerInput from "@/components/ui/TimePickerInput";
import { asText, type FieldProps } from "./types";

export default function TimeField({ field, value, onChange, error }: FieldProps) {
  return (
    <TimePickerInput
      value={asText(value)}
      onChange={(time) => onChange(time)}
      placeholder={field.placeholder || "e.g. HH:MM AM/PM"}
      hasError={!!error}
      className="pl-10"
    />
  );
}
