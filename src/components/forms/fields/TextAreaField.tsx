import { asText, type FieldProps } from "./types";

export default function TextAreaField({ field, value, onChange, register, error, variant }: FieldProps) {
  if (variant === "transaction") {
    return (
      <textarea
        value={asText(value)}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder || `Enter ${field.name}...`}
        className={`w-full bg-white rounded-xl border p-4 outline-none text-sm font-medium text-slate-700 placeholder:text-slate-300 focus:ring-2 focus:ring-orange-500/20 shadow-sm transition-all resize-none h-[90px] ${error ? "border-red-400" : "border-slate-200 focus:border-orange-400"}`}
      />
    );
  }

  return (
    <textarea
      className={`flex w-full rounded-xl border bg-white pl-10 pr-4 py-2 text-[0.95rem] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 min-h-[80px] ${error ? "border-red-500" : "border-gray-200"}`}
      {...register}
      placeholder={field.placeholder || `Enter ${field.name}...`}
    />
  );
}
