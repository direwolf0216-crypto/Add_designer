"use client";

import { useEffect, useState } from "react";
import { GlassCard } from "@/components/dashboard/vibrant";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then(r => r.json());

/** Record `id` as dismissed now, persist the map, and return it (called from the Dismiss click handler). */
function persistDismissal(dismissed: Record<string, number>, id: string) {
  const newDismissed = { ...dismissed, [id]: Date.now() };
  if (typeof window !== 'undefined') {
    window.localStorage.setItem("dismissed_jobs", JSON.stringify(newDismissed));
  }
  return newDismissed;
}

/** Confirmed jobs whose delivery date has passed (shared by the rail and the dashboard's title line). */
/** The first 200 overdue jobs plus the true total (sent in X-Total-Count). */
const overdueFetcher = async (url: string) => {
  const res = await fetch(url);
  const body = await res.json();
  const jobs: any[] = Array.isArray(body) ? body : (body?.jobs ?? body?.data ?? []);
  const total = Number(res.headers.get("X-Total-Count"));
  return { jobs, total: Number.isFinite(total) && total > 0 ? total : jobs.length };
};

export function useOverdueJobs() {
  const { data, mutate, isLoading } = useSWR("/api/jobs/overdue#with-total", (key: string) => overdueFetcher(key.split("#")[0]), {
    refreshInterval: 60000,
    revalidateOnFocus: false,
    dedupingInterval: 30000,
  });
  return { jobs: data?.jobs ?? [], total: data?.total ?? 0, mutate, isLoading };
}

const DAY_MS = 24 * 60 * 60 * 1000;
const CAP = 5;

/** "24 Apr" (job dates are calendar days stored at UTC midnight). */
const dueLabel = (date: string) =>
  new Date(date).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });

function daysLate(date: string) {
  const days = Math.floor((Date.now() - new Date(date).getTime()) / DAY_MS);
  return days <= 1 ? "1d late" : `${days.toLocaleString("en-IN")}d late`;
}

/** The dashboard rail's "Overdue deliveries": capped rows, each with Mark complete and Dismiss. */
export default function OverdueJobBanners() {
  const { jobs: jobsArray, total: overdueTotal, mutate, isLoading } = useOverdueJobs();

  const [dismissed, setDismissed] = useState<Record<string, number>>({});
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    // Load dismissed state from localStorage on mount
    const loadDismissed = () => {
      if (typeof window !== 'undefined') {
        const stored = window.localStorage.getItem("dismissed_jobs");
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            const now = Date.now();
            const valid: Record<string, number> = {};
            
            // Only keep items dismissed within the last 24h
            Object.entries(parsed).forEach(([id, timestamp]) => {
              if (now - (timestamp as number) < 24 * 60 * 60 * 1000) {
                valid[id] = timestamp as number;
              }
            });
            
            setDismissed(valid);
            window.localStorage.setItem("dismissed_jobs", JSON.stringify(valid));
          } catch (e) {
            console.error("Failed to parse dismissed jobs", e);
          }
        }
      }
    };
    loadDismissed();
  }, []);

  const handleDismiss = (id: string) => {
    setDismissed(persistDismissal(dismissed, id));
  };

  const handleComplete = async (id: string) => {
    try {
      const res = await fetch(`/api/jobs/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Printing Completed" })
      });
      if (res.ok) {
        mutate();
        if (typeof window !== 'undefined') window.location.reload();
      } else {
        console.error("Failed to update status");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const visibleJobs = jobsArray.filter((b: any) => !dismissed[b.id]);
  const displayJobs = isExpanded ? visibleJobs : visibleJobs.slice(0, CAP);
  const total = jobsArray.length;
  const hiddenCount = total - visibleJobs.length;

  return (
    <GlassCard
      icon="ph-warning-diamond"
      tone="amber"
      title="Overdue deliveries"
      subtitle={overdueTotal > 0 ? `${overdueTotal.toLocaleString("en-IN")} jobs past their delivery date` : "Delivery date has passed"}
      action={
        visibleJobs.length > CAP ? (
          <button
            type="button"
            onClick={() => setIsExpanded((v) => !v)}
            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-orange-50 px-3 py-1 text-xs font-bold text-orange-600 transition-colors hover:bg-orange-100"
          >
            {isExpanded ? "Less" : "More"}
          </button>
        ) : undefined
      }
    >
      {isLoading && total === 0 ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-[68px] animate-pulse rounded-2xl bg-slate-100/80" />
          ))}
        </div>
      ) : visibleJobs.length === 0 ? (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-3 text-sm font-semibold text-emerald-700">
          <i className="ph-bold ph-check-circle text-lg" aria-hidden="true"></i>
          {total === 0
            ? "Nothing overdue. Every confirmed job is on time."
            : `${total} overdue ${total === 1 ? "reminder is" : "reminders are"} dismissed for today.`}
        </div>
      ) : (
        <ul className={`flex flex-col gap-2.5 ${isExpanded ? "max-h-[480px] overflow-y-auto pr-1" : ""}`}>
          {displayJobs.map((job: any, i: number) => (
            <li
              key={job.id}
              className="animate-rise group relative flex items-center gap-3 overflow-hidden rounded-2xl border border-orange-100 bg-gradient-to-r from-orange-50/90 to-white px-3 py-2.5 transition-shadow hover:shadow-md hover:shadow-orange-500/10"
              style={{ ["--i" as string]: i }}
            >
              <span className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-orange-400 to-pink-500" aria-hidden="true" />
              <span className="ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-orange-500 shadow-sm ring-1 ring-orange-100">
                <i className="ph-fill ph-printer text-[17px]" aria-hidden="true"></i>
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-slate-900">{job.client?.name || "Unknown client"}</p>
                <p className="num truncate text-xs font-medium text-slate-500">
                  Due {dueLabel(job.date)} · <span className="font-bold text-rose-500">{daysLate(job.date)}</span>
                  {job.category ? ` · ${job.category}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleComplete(job.id)}
                title="Mark complete"
                aria-label={`Mark ${job.client?.name || "this job"} complete`}
                className="inline-flex size-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-orange-500 to-pink-500 text-xs font-bold text-white shadow-md shadow-orange-500/25 transition-transform hover:-translate-y-px active:scale-[0.97]"
              >
                <i className="ph-bold ph-check text-[13px]" aria-hidden="true"></i>
              </button>
              <button
                type="button"
                onClick={() => handleDismiss(job.id)}
                aria-label={`Dismiss reminder for ${job.client?.name || "this job"}`}
                title="Dismiss for today"
                className="inline-flex size-8 shrink-0 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-white hover:text-slate-700"
              >
                <i className="ph-bold ph-x text-[13px]" aria-hidden="true"></i>
              </button>
            </li>
          ))}
        </ul>
      )}

      {hiddenCount > 0 && visibleJobs.length > 0 && (
        <p className="num mt-3 text-xs font-medium text-slate-400">{hiddenCount} dismissed for today</p>
      )}
    </GlassCard>
  );
}
