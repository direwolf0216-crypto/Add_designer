import type { ReactNode } from "react";

/** Job-form input wrapper: phosphor icon inside the left padding of the control. */
export function IconWrap({ icon, hideIcon = false, children }: { icon: string; hideIcon?: boolean; children: ReactNode }) {
  return (
    <div className="relative">
      {!hideIcon && (
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 z-10">
          <i className={`ph-bold ${icon} text-[1.1rem]`}></i>
        </div>
      )}
      {children}
    </div>
  );
}

/** Transaction-form field wrapper: uppercase label above the control and the error message below. */
export function FieldShell({
  label,
  mandatory,
  errorMessage,
  className,
  compactLabel = false,
  children,
  after,
}: {
  label: string;
  mandatory?: boolean;
  errorMessage?: string;
  className?: string;
  /** Label without bottom margin (used inside a gap-based column). */
  compactLabel?: boolean;
  children: ReactNode;
  /** Rendered below the error message. */
  after?: ReactNode;
}) {
  return (
    <div className={className}>
      <label className={`block text-[10px] font-extrabold text-slate-500 tracking-[1.5px] uppercase${compactLabel ? "" : " mb-2"}`}>
        {label} {mandatory && <span className="text-red-500">*</span>}
      </label>
      {children}
      {errorMessage && <p className="text-xs text-red-500 mt-1 font-medium">{errorMessage}</p>}
      {after}
    </div>
  );
}
