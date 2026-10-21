import type { ReactNode } from "react";

/** Label/value row used by the details views. Empty values show "N/A". */
export default function ReadOnlyField({ label, value }: { label: string; value: unknown }) {
  const display = value === undefined || value === null || value === "" ? "N/A" : value;
  return (
    <div className="flex justify-between items-center py-3 md:px-4">
      <span className="text-sm text-slate-500 font-medium">{label}</span>
      <span className="text-sm font-bold text-slate-800 text-right break-words max-w-[50%]">{display as ReactNode}</span>
    </div>
  );
}
