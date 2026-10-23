import { isBlankValue } from "@/lib/display/blank";
import type { ReactNode } from "react";

/** White card with an icon badge and title, as used by every block of the job details view. */
export function DetailsCard({
  icon,
  iconBg,
  title,
  className,
  children,
}: {
  icon: ReactNode;
  /** Badge background, e.g. "bg-indigo-50". */
  iconBg: string;
  title: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`bg-white rounded-xl p-6 border border-slate-100 shadow-sm flex flex-col gap-5${className ? ` ${className}` : ""}`}>
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-lg ${iconBg} flex items-center justify-center`}>{icon}</div>
        <h3 className="font-bold text-slate-800 text-[15px]">{title}</h3>
      </div>
      {children}
    </div>
  );
}

/** Label on the left, bold value on the right. */
/** A label and its value; a blank value (nothing, N/A, nil, a dash or zero) leaves the row out. */
export function InfoRow({ label, children }: { label: ReactNode; children: ReactNode }) {
  if ((typeof children === "string" || typeof children === "number" || children == null) && isBlankValue(children)) return null;
  return (
    <div className="flex justify-between items-center py-3">
      <span className="text-sm text-slate-500 font-medium">{label}</span>
      <span className="text-sm font-bold text-slate-800 text-right">{children}</span>
    </div>
  );
}
