import { asText, type FieldProps } from "./types";
import { capitalizeFirst, capitalizeInput, capitalizesFirst } from "@/lib/forms/capitalize";

const JOB_INPUT =
  "flex h-[45px] w-full rounded-xl border bg-white pl-11 pr-4 py-2 text-[0.95rem] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500";

/** Single-line input; the fallback for every field type a form does not render specially. */
export default function TextField({
  field,
  value,
  onChange,
  register,
  error,
  variant,
  fallbackPlaceholder,
  inputType,
}: FieldProps & { fallbackPlaceholder?: string; inputType?: string }) {
  const typeAttr = inputType || (field.type === "EMAIL" ? "email" : "text");
  // Single-line text starts with a capital letter as it's typed.
  const cap = capitalizesFirst(field);
  const fix = (text: string) => (cap ? capitalizeFirst(text) : text);

  if (variant === "transaction") {
    return (
      <input
        type="text"
        value={asText(value)}
        onChange={(e) => onChange(fix(e.target.value))}
        placeholder={field.placeholder || `Enter ${field.name}...`}
        className={`flex h-[45px] w-full rounded-xl border bg-white px-4 py-2 text-[0.95rem] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 shadow-sm ${error ? "border-red-400" : "border-slate-200"}`}
      />
    );
  }

  if (variant === "jobRepeatable") {
    return (
      <input
        type={typeAttr}
        autoComplete="new-password"
        className={`${JOB_INPUT} border-gray-200`}
        value={asText(value)}
        onChange={(e) => onChange(fix(e.target.value))}
        placeholder={field.placeholder || `e.g. Enter ${field.name}...`}
      />
    );
  }

  return (
    <input
      type={typeAttr}
      autoComplete="new-password"
      className={`${JOB_INPUT} ${error ? "border-red-500" : "border-gray-200"}`}
      {...register}
      onChange={(e) => {
        if (cap) capitalizeInput(e.currentTarget);
        return register?.onChange(e);
      }}
      placeholder={field.placeholder || fallbackPlaceholder || `e.g. Enter ${field.name}...`}
    />
  );
}
