import DatePickerInput from "@/components/ui/DatePickerInput";
import TimePickerInput from "@/components/ui/TimePickerInput";
import { asText, type FieldProps } from "./types";

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Job variants store a `yyyy-MM-dd` date. The transaction variant stores a full ISO timestamp and
 * edits its local date and time side by side.
 */
export default function DateField({ field, value, onChange, variant }: FieldProps) {
  if (variant === "transaction") {
    const d = value ? new Date(value as string) : new Date();
    const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const timeStr = `${pad(d.getHours())}:${pad(d.getMinutes())}`;

    return (
      <div className="grid grid-cols-2 gap-3">
        <DatePickerInput
          value={dateStr}
          onChange={(newDate) => onChange(new Date(`${newDate}T${timeStr}:00`).toISOString())}
          disableFutureDates={!!field.restrictFutureDate}
        />
        <TimePickerInput
          value={timeStr}
          onChange={(newTime) => onChange(new Date(`${dateStr}T${newTime}:00`).toISOString())}
        />
      </div>
    );
  }

  return (
    <DatePickerInput
      value={asText(value)}
      onChange={(date) => onChange(date)}
      placeholder={field.placeholder || "Select Date..."}
      disableFutureDates={!!field.restrictFutureDate}
      className="pl-10"
    />
  );
}
