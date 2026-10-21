"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { X, Calendar, ArrowRight, Clock, MapPin, User } from "lucide-react";
import Link from "next/link";
import useSWR from "swr";
import { fetcher } from "@/lib/swr";
import { toLocalISODate } from "@/lib/dates";

type BannerJob = { id: string; category?: string; time?: string; location?: string; client?: { name?: string } };
type BannerData = {
  show?: boolean;
  settings?: { bannerTime1: string; bannerTime2: string };
  day1?: BannerJob[];
  day2?: BannerJob[];
};

const noopSubscribe = () => () => {};

/** Which reminder slot (0 = none yet today) the current time falls in, given two HH:mm times. */
function activeSlot(now: Date, times: [string, string]) {
  const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const [t1, t2] = [...times].sort();
  if (hhmm >= t2) return { slot: 2, time: t2 };
  if (hhmm >= t1) return { slot: 1, time: t1 };
  return { slot: 0, time: "" };
}

function DayCard({ title, label, accent, jobs, onNavigate }: { title: string; label: string; accent: "purple" | "pink"; jobs: BannerJob[]; onNavigate: () => void }) {
  const tone = accent === "purple" ? { chip: "bg-purple-500", sub: "text-purple-300" } : { chip: "bg-pink-500", sub: "text-pink-300" };
  return (
    <div className="flex-1 w-full bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-4 shadow-lg">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-8 h-8 rounded-lg ${tone.chip} text-white flex items-center justify-center shadow-sm`}>
          <Calendar size={16} aria-hidden="true" />
        </div>
        <div>
          <div className="text-white font-bold text-sm">{title}</div>
          <div className={`${tone.sub} text-[10px] font-semibold uppercase tracking-wider`}>{label}</div>
        </div>
      </div>
      <ul className="space-y-3">
        {jobs.slice(0, 2).map((b) => (
          <li key={b.id}>
            <Link href={`/jobs/details/${b.id}`} onClick={onNavigate} className="block p-2 -mx-2 rounded-lg hover:bg-white/10 focus-visible:bg-white/10 transition-colors">
              <div className="flex items-center justify-between gap-2">
                <div className="text-white font-semibold text-sm truncate">{b.category || "Job"}</div>
                {b.client?.name && (
                  <div className={`${tone.sub} text-[11px] flex items-center gap-1 shrink-0`}>
                    <User size={10} aria-hidden="true" />
                    <span className="truncate max-w-[80px]">{b.client.name.split(" ")[0]}</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1">
                {b.time && (
                  <div className="text-slate-300 text-xs flex items-center gap-1 shrink-0">
                    <Clock size={10} aria-hidden="true" />
                    {b.time}
                  </div>
                )}
                {b.location && (
                  <div className="text-slate-300 text-xs flex items-center gap-1 truncate">
                    <MapPin size={10} className="shrink-0" aria-hidden="true" />
                    <span className="truncate max-w-[140px]">{b.location}</span>
                  </div>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ul>
      {jobs.length > 2 && <div className={`text-xs ${tone.sub} font-medium mt-2`}>+{jobs.length - 2} more</div>}
    </div>
  );
}

/** Twice-daily reminder of the next two days' jobs. Times come from system settings. */
export default function UpcomingJobsBanner() {
  const { data } = useSWR<BannerData>("/api/banner", fetcher, {
    revalidateOnFocus: false,
    refreshInterval: 300000,
  });

  // Re-evaluate the slot every 30s; only the interval callback sets state.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);

  const [dismissedKeys, setDismissedKeys] = useState<string[]>([]);
  const isClient = useSyncExternalStore(noopSubscribe, () => true, () => false);

  const { slot, time } = data?.settings ? activeSlot(now, [data.settings.bannerTime1, data.settings.bannerTime2]) : { slot: 0, time: "" };
  const key = slot > 0 ? `bannerDismissed:${toLocalISODate(now)}_slot${slot}_time${time}` : "";
  const dismissedInSession = (() => {
    if (!isClient || !key) return false;
    try {
      return sessionStorage.getItem(key) === "true";
    } catch {
      return false;
    }
  })();
  const show = Boolean(data?.show && key && !dismissedInSession && !dismissedKeys.includes(key));

  const dismiss = () => {
    if (!key) return;
    setDismissedKeys((prev) => [...prev, key]);
    try {
      sessionStorage.setItem(key, "true");
    } catch {}
  };

  useEffect(() => {
    if (!show) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  if (!show) return null;

  const day1 = data?.day1 ?? [];
  const day2 = data?.day2 ?? [];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-fade-in" role="dialog" aria-modal="true" aria-labelledby="upcoming-banner-title">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={dismiss} aria-hidden="true" />
      <div className="relative w-full max-w-[960px] min-h-[420px] rounded-[24px] shadow-2xl overflow-hidden flex flex-col md:flex-row bg-gradient-to-br from-slate-900 via-indigo-950 to-purple-900">
        <button
          type="button"
          onClick={dismiss}
          autoFocus
          aria-label="Dismiss"
          className="absolute top-4 right-4 z-40 w-8 h-8 flex items-center justify-center rounded-full bg-slate-900/50 hover:bg-slate-900 text-white transition-colors border border-white/10"
        >
          <X size={18} strokeWidth={2.5} aria-hidden="true" />
        </button>

        <div className="p-8 md:p-10 w-full md:w-[45%] relative z-20 flex flex-col justify-center shrink-0">
          <div className="flex items-center gap-2 bg-purple-500/20 w-fit px-3 py-1.5 rounded-full border border-purple-500/30 mb-6">
            <Calendar size={14} className="text-purple-300" aria-hidden="true" />
            <span className="text-xs font-bold text-purple-200">Next 2 Days</span>
          </div>
          <h2 id="upcoming-banner-title" className="text-4xl md:text-5xl font-extrabold text-white leading-tight mb-2 tracking-tight">
            Coming up <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-purple-400">next</span>
          </h2>
          <p className="text-slate-300 text-lg mb-8 max-w-sm">
            Here&apos;s your job plan for the <span className="text-pink-400 font-semibold">next 2 days</span>.
          </p>
          <Link
            href="/jobs?view=schedule"
            onClick={dismiss}
            className="group inline-flex items-center justify-center gap-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white px-8 py-3.5 rounded-full font-bold text-[15px] transition-all hover:-translate-y-0.5 w-fit"
          >
            View Schedule
            <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" aria-hidden="true" />
          </Link>
        </div>

        <div className="w-full md:w-[55%] relative z-20 flex flex-col justify-center p-6 md:p-8 pt-0 md:pt-8">
          <div className={`w-full grid ${day1.length > 0 && day2.length > 0 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"} gap-3`}>
            {day1.length > 0 && <DayCard title="Tomorrow" label="Day 1" accent="purple" jobs={day1} onNavigate={dismiss} />}
            {day2.length > 0 && <DayCard title="Day after tomorrow" label="Day 2" accent="pink" jobs={day2} onNavigate={dismiss} />}
          </div>
        </div>
      </div>
    </div>
  );
}
