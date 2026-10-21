import { asText, type FieldProps } from "./types";

/** ₹-prefixed amount input inside a repeatable job entry. */
export default function CurrencyField({ field, value, onChange }: FieldProps) {
  return (
    <div className="relative">
      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
        <span className="text-gray-500 font-bold text-[0.95rem]">₹</span>
      </div>
      <input
        type="text"
        autoComplete="new-password"
        className="flex h-[45px] w-full rounded-xl border bg-white pl-8 pr-4 py-2 text-[0.95rem] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 border-gray-200"
        value={asText(value)}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder || `e.g. Enter ${field.name}...`}
      />
    </div>
  );
}
