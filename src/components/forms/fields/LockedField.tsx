import type { FormField } from "@/lib/forms/types";

/** A field this viewer may see but not change: its current value in a disabled box. */
export default function LockedField({ field, value, variant }: { field: FormField; value: unknown; variant?: "job" | "jobRepeatable" | "transaction" }) {
  const text = Array.isArray(value) ? value.join(", ") : value === null || value === undefined || value === "" ? "—" : typeof value === "boolean" ? (value ? "Yes" : "No") : String(value);
  const pad = variant === "transaction" ? "pl-4" : "pl-11";
  return (
    <div
      title={`${field.name} can't be changed by you`}
      aria-readonly="true"
      className={`flex h-[45px] w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 ${pad} pr-3 text-[0.95rem] text-slate-600 cursor-not-allowed select-text`}
    >
      <span className="truncate">{text}</span>
      <i className="ph-bold ph-lock-simple text-slate-400 shrink-0 ml-2"></i>
    </div>
  );
}
