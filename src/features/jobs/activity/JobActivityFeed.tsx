"use client";

import useSWRInfinite from "swr/infinite";
import { format, formatDistanceToNow, isToday, isYesterday } from "date-fns";
import { fetcher } from "@/lib/swr";
import { Avatar } from "@/features/jobs/assignees/AssigneeAvatars";
import EmptyState from "@/components/ui/empty-state";

type Change = { field: string; label: string; from: string | null; to: string | null };
type Activity = {
  id: string;
  type: string;
  summary: string;
  changes: Change[] | null;
  createdAt: string;
  actor: { id: string; name: string | null; email: string | null; image?: string | null } | null;
};
type Page = { items: Activity[]; nextCursor: string | null };

const TYPE_STYLE: Record<string, { icon: string; chip: string }> = {
  CREATED: { icon: "ph-sparkle", chip: "bg-emerald-50 text-emerald-600 ring-emerald-100" },
  UPDATED: { icon: "ph-pencil-simple-line", chip: "bg-sky-50 text-sky-600 ring-sky-100" },
  STATUS_CHANGED: { icon: "ph-arrows-clockwise", chip: "bg-violet-50 text-violet-600 ring-violet-100" },
  ASSIGNED: { icon: "ph-user-plus", chip: "bg-orange-50 text-orange-600 ring-orange-100" },
  UNASSIGNED: { icon: "ph-user-minus", chip: "bg-slate-100 text-slate-500 ring-slate-200" },
  PAYMENT_ADDED: { icon: "ph-currency-inr", chip: "bg-emerald-50 text-emerald-600 ring-emerald-100" },
  PAYMENT_UPDATED: { icon: "ph-currency-inr", chip: "bg-amber-50 text-amber-600 ring-amber-100" },
  PAYMENT_DELETED: { icon: "ph-currency-inr", chip: "bg-rose-50 text-rose-600 ring-rose-100" },
  PAYMENT_RESTORED: { icon: "ph-arrow-counter-clockwise", chip: "bg-emerald-50 text-emerald-600 ring-emerald-100" },
  INVOICE_GENERATED: { icon: "ph-receipt", chip: "bg-indigo-50 text-indigo-600 ring-indigo-100" },
  ATTACHMENT_ADDED: { icon: "ph-paperclip", chip: "bg-sky-50 text-sky-600 ring-sky-100" },
  PROOF_DELIVERED: { icon: "ph-seal-check", chip: "bg-emerald-50 text-emerald-600 ring-emerald-100" },
  FINISHING_UPDATED: { icon: "ph-book-bookmark", chip: "bg-fuchsia-50 text-fuchsia-600 ring-fuchsia-100" },
  DELETED: { icon: "ph-trash", chip: "bg-rose-50 text-rose-600 ring-rose-100" },
  RESTORED: { icon: "ph-arrow-counter-clockwise", chip: "bg-emerald-50 text-emerald-600 ring-emerald-100" },
};

function dayLabel(d: Date) {
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  return format(d, "EEE, d MMM yyyy");
}

/** Admin-only job audit trail (the API also enforces admin). */
export default function JobActivityFeed({ jobId }: { jobId: string }) {
  const { data, error, size, setSize, isLoading, isValidating } = useSWRInfinite<Page>(
    (index, prev) => {
      if (prev && !prev.nextCursor) return null;
      const cursor = index === 0 ? "" : `&cursor=${prev!.nextCursor}`;
      return `/api/jobs/${jobId}/activity?limit=50${cursor}`;
    },
    fetcher,
    { revalidateOnFocus: false }
  );

  const items = data?.flatMap((p) => p.items) ?? [];
  const hasMore = Boolean(data?.[data.length - 1]?.nextCursor);

  if (error) return <EmptyState icon="ph-warning-circle" title="Couldn't load activity" description="Please try again in a moment." />;
  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 p-2" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex gap-3">
            <div className="h-9 w-9 animate-pulse rounded-xl bg-slate-100" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-2/3 animate-pulse rounded bg-slate-100" />
              <div className="h-3 w-1/4 animate-pulse rounded bg-slate-100" />
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (items.length === 0) return <EmptyState icon="ph-clock-counter-clockwise" title="No activity yet" description="Changes to this job will appear here." />;

  const groups: { label: string; items: Activity[] }[] = [];
  for (const a of items) {
    const label = dayLabel(new Date(a.createdAt));
    const last = groups[groups.length - 1];
    if (last?.label === label) last.items.push(a);
    else groups.push({ label, items: [a] });
  }

  return (
    <div className="flex flex-col gap-6">
      {groups.map((g) => (
        <section key={g.label}>
          <h4 className="mb-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">{g.label}</h4>
          <ol className="relative flex flex-col gap-4 before:absolute before:bottom-2 before:left-[17px] before:top-2 before:w-px before:bg-slate-200">
            {g.items.map((a, idx) => {
              const style = TYPE_STYLE[a.type] ?? { icon: "ph-dot-outline", chip: "bg-slate-100 text-slate-500 ring-slate-200" };
              const who = a.actor?.name || a.actor?.email || "System";
              return (
                <li key={a.id} className="animate-rise relative flex gap-3" style={{ ["--i" as string]: Math.min(idx, 8) }}>
                  <span className={`relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-4 ring-white ${style.chip}`}>
                    <i className={`ph-bold ${style.icon} text-[15px]`} aria-hidden="true"></i>
                  </span>
                  <div className="min-w-0 flex-1 rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-[0_6px_20px_-14px_rgba(15,23,42,0.3)]">
                    <div className="flex items-start gap-2">
                      <Avatar name={who} image={a.actor?.image} size={22} ring={false} />
                      <p className="min-w-0 flex-1 text-sm text-slate-700">
                        <span className="font-extrabold text-slate-900">{who}</span>{" "}
                        {a.summary.charAt(0).toLowerCase() + a.summary.slice(1)}
                      </p>
                      <time
                        className="shrink-0 text-[11px] font-semibold text-slate-400"
                        dateTime={a.createdAt}
                        title={new Date(a.createdAt).toLocaleString("en-IN")}
                      >
                        {formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}
                      </time>
                    </div>
                    {a.changes && a.changes.length > 0 && (
                      <dl className="mt-2.5 grid gap-1.5 rounded-xl bg-slate-50/80 p-2.5">
                        {a.changes.map((c, i) => (
                          <div key={`${c.field}-${i}`} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                            <dt className="min-w-[90px] font-bold text-slate-500">{c.label}</dt>
                            <dd className="flex flex-wrap items-center gap-1.5">
                              <span className="rounded-md bg-white px-1.5 py-0.5 text-slate-400 line-through ring-1 ring-slate-200">{c.from ?? "empty"}</span>
                              <i className="ph-bold ph-arrow-right text-[10px] text-slate-400" aria-hidden="true"></i>
                              <span className="rounded-md bg-white px-1.5 py-0.5 font-semibold text-slate-800 ring-1 ring-slate-200">{c.to ?? "empty"}</span>
                            </dd>
                          </div>
                        ))}
                      </dl>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
      {hasMore && (
        <button
          type="button"
          onClick={() => setSize(size + 1)}
          disabled={isValidating}
          className="mx-auto inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 shadow-sm hover:bg-slate-50 disabled:opacity-50"
        >
          {isValidating ? <i className="ph-bold ph-circle-notch animate-spin" aria-hidden="true"></i> : <i className="ph-bold ph-clock-counter-clockwise" aria-hidden="true"></i>}
          Load older activity
        </button>
      )}
    </div>
  );
}
