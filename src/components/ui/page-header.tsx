import type { ReactNode } from "react";

/** Consistent page/section header: icon tile, title, subtitle and right-aligned actions. */
export default function PageHeader({ icon, title, subtitle, actions }: { icon: string; title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-900 to-slate-700 text-white shadow-lg shadow-slate-900/20">
        <i className={`ph-bold ${icon} text-[22px]`} aria-hidden="true"></i>
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="text-xl font-extrabold tracking-tight text-slate-900">{title}</h2>
        {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
