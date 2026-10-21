import React from 'react';
import { useGlobalForm } from "@/components/providers/GlobalFormProvider";
import { GlassCard, HeaderLink } from "./vibrant";

interface JobBreakdownProps {
  data?: { id: string; clientName: string; status: string; date: string }[];
}

/** Stage pill: pending neutral, in progress in the brand tint, ready in green. */
function StageBadge({ status }: { status: string }) {
  const s = status.trim().toLowerCase();
  const tone =
    s === 'designing' || s === 'sent for printing' || s.includes('printing') || s.includes('progress')
      ? 'bg-sky-50 text-sky-600 ring-1 ring-sky-100'
      : s.startsWith('ready')
        ? 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100'
        : 'bg-amber-50 text-amber-600 ring-1 ring-amber-100';
  const label = s === 'sent for printing' ? 'Printing' : status.charAt(0).toUpperCase() + status.slice(1);
  return (
    <span className={`inline-flex h-5 flex-none items-center whitespace-nowrap rounded-full px-2.5 text-[11px] font-bold ${tone}`}>
      {label}
    </span>
  );
}

/** Jobs waiting on binding, lamination or framing. */
export default function JobBreakdown({ data = [] }: JobBreakdownProps) {
  const { openJobDetails } = useGlobalForm();

  return (
    <GlassCard icon="ph-book-open" tone="sky" title="Finishing work" subtitle="Binding, lamination and framing" action={<HeaderLink href="/jobs" tone="sky">View all</HeaderLink>}>
      <div className="flex flex-col gap-2">
        {(!data || data.length === 0) ? (
          <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-3 text-sm font-medium text-slate-500">
            No binding, lamination or framing waiting in this period.
          </p>
        ) : (
          data.slice(0, 5).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => openJobDetails(item.id)}
              className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white/70 px-3 py-2.5 text-left transition-[box-shadow,transform] duration-200 hover:-translate-y-px hover:shadow-md"
            >
              <span className="flex min-w-0 items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-500 ring-1 ring-sky-100">
                  <i className="ph-bold ph-book-bookmark text-[16px]" aria-hidden="true"></i>
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold text-slate-900">{item.clientName}</span>
                  <span className="num block text-xs font-medium text-slate-500">
                    Due {new Date(item.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </span>
              </span>
              <StageBadge status={item.status} />
            </button>
          ))
        )}
      </div>
    </GlassCard>
  );
}
