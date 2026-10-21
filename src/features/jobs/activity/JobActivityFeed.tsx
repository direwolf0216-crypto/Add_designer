"use client";

import useSWRInfinite from "swr/infinite";
import { formatDistanceToNow } from "date-fns";
import { fetcher } from "@/lib/swr";

type Change = { field: string; label: string; from: string | null; to: string | null };
type Activity = {
  id: string;
  type: string;
  summary: string;
  changes: Change[] | null;
  createdAt: string;
  actor: { id: string; name: string | null; email: string | null } | null;
};
type Page = { items: Activity[]; nextCursor: string | null };

const TYPE_ICON: Record<string, string> = {
  CREATED: "ph-plus-circle",
  UPDATED: "ph-pencil-simple",
  STATUS_CHANGED: "ph-arrows-clockwise",
  ASSIGNED: "ph-user-plus",
  UNASSIGNED: "ph-user-minus",
  PAYMENT_ADDED: "ph-currency-inr",
  PAYMENT_UPDATED: "ph-currency-inr",
  PAYMENT_DELETED: "ph-trash",
  PAYMENT_RESTORED: "ph-arrow-counter-clockwise",
  INVOICE_GENERATED: "ph-receipt",
  ATTACHMENT_ADDED: "ph-paperclip",
  PROOF_DELIVERED: "ph-check-circle",
  FINISHING_UPDATED: "ph-book-open",
  DELETED: "ph-trash",
  RESTORED: "ph-arrow-counter-clockwise",
};

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

  if (error) return <p className="p-6 text-sm text-rose-600">Couldn&apos;t load activity.</p>;
  if (isLoading) return <div className="m-6 h-24 animate-pulse rounded-xl bg-slate-100" aria-busy="true" />;
  if (items.length === 0) return <p className="p-6 text-sm text-slate-500">No activity recorded for this job yet.</p>;

  return (
    <div className="flex flex-col gap-1 p-2">
      <ol className="relative border-l border-slate-200 pl-6">
        {items.map((a) => (
          <li key={a.id} className="mb-5">
            <span className="absolute -left-[13px] flex h-6 w-6 items-center justify-center rounded-full bg-white ring-1 ring-slate-200">
              <i className={`ph-bold ${TYPE_ICON[a.type] ?? "ph-dot"} text-xs text-slate-600`} aria-hidden="true"></i>
            </span>
            <p className="text-sm text-slate-800">
              <span className="font-bold">{a.actor?.name || a.actor?.email || "System"}</span> {a.summary.charAt(0).toLowerCase() + a.summary.slice(1)}
            </p>
            <time className="text-xs text-slate-400" dateTime={a.createdAt} title={new Date(a.createdAt).toLocaleString("en-IN")}>
              {formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}
            </time>
            {a.changes && a.changes.length > 0 && (
              <details className="mt-1 text-xs text-slate-600">
                <summary className="cursor-pointer font-semibold text-slate-500 hover:text-slate-700">
                  {a.changes.length} change{a.changes.length === 1 ? "" : "s"}
                </summary>
                <ul className="mt-1 space-y-0.5">
                  {a.changes.map((c, i) => (
                    <li key={`${c.field}-${i}`}>
                      <span className="font-semibold">{c.label}:</span>{" "}
                      <span className="text-slate-400 line-through">{c.from ?? "—"}</span> → <span>{c.to ?? "—"}</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </li>
        ))}
      </ol>
      {hasMore && (
        <button
          type="button"
          onClick={() => setSize(size + 1)}
          disabled={isValidating}
          className="mx-auto rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        >
          {isValidating ? "Loading…" : "Load older activity"}
        </button>
      )}
    </div>
  );
}
