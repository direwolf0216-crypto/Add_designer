import type { ReactNode } from "react";

export default function EmptyState({ icon, title, description, action }: { icon: string; title: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white/70 px-6 py-14 text-center backdrop-blur">
      <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-50 to-pink-50 text-orange-500 ring-1 ring-orange-100">
        <i className={`ph-bold ${icon} text-2xl`} aria-hidden="true"></i>
      </span>
      <p className="text-sm font-extrabold text-slate-900">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
