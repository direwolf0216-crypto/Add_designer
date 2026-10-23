import type { ReactNode } from "react";

/** Job-form input wrapper: phosphor icon inside the left padding of the control. */
export function IconWrap({ icon, hideIcon = false, children }: { icon: string; hideIcon?: boolean; children: ReactNode }) {
  return (
    <div className="relative">
      {!hideIcon && (
        // A soft tile behind the icon keeps it apart from the text that follows.
        <div className="absolute inset-y-0 left-0 pl-[7px] flex items-center pointer-events-none z-10">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600 ring-1 ring-slate-200/70">
            <i className={`ph-bold ${icon} text-[0.95rem]`}></i>
          </span>
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
