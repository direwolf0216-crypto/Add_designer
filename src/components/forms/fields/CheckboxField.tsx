import type { FieldProps } from "./types";

export default function CheckboxField({ field, value, onChange, register, error, variant }: FieldProps) {
  if (variant === "transaction") {
    return (
      <div className="flex items-center h-[45px] w-full rounded-xl border bg-white px-4 transition-colors border-slate-200 mt-6">
        <label className="flex items-center gap-3 cursor-pointer w-full h-full">
          <input
            type="checkbox"
            className="w-5 h-5 accent-orange-500 rounded border-gray-300 cursor-pointer"
            checked={value === true || value === "true"}
            onChange={(e) => onChange(e.target.checked.toString())}
          />
          <span className="text-[0.95rem] text-slate-600 font-medium select-none">{field.name}</span>
        </label>
      </div>
    );
  }

  return (
    <div className={`flex items-center h-[45px] w-full rounded-xl border bg-white px-4 transition-colors ${error ? "border-red-500" : "border-gray-200"}`}>
      <label className="flex items-center gap-3 cursor-pointer w-full h-full">
        <input type="checkbox" className="w-5 h-5 accent-blue-500 rounded border-gray-300 cursor-pointer" {...register} />
        <span className="text-[0.95rem] text-slate-600 font-medium select-none">{field.name}</span>
      </label>
    </div>
  );
}
