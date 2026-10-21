"use client";
import React, { useState, useEffect, useSyncExternalStore } from "react";
import useSWR from "swr";
import Link from "next/link";
import { GlassCard } from "./vibrant";

import { fetcher } from "@/lib/swr";

interface TaskAlertsProps {
  unconfirmedCount?: number;
  pendingProofs?: number;
}

const DISMISS_PREFIX = 'dismissed_alert_';
const DISMISS_TTL_MS = 24 * 60 * 60 * 1000;
const noopSubscribe = () => () => {};

/** Ids dismissed within the last 24h. Empty on the server; only read once on the client. */
function readDismissedAlerts(): string[] {
  if (typeof window === 'undefined') return [];
  const dismissed: string[] = [];
  const now = Date.now();
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(DISMISS_PREFIX)) {
        const val = localStorage.getItem(key);
        if (val && now - parseInt(val, 10) < DISMISS_TTL_MS) {
          dismissed.push(key.replace(DISMISS_PREFIX, ''));
        }
      }
    }
  } catch {}
  return dismissed;
}

function markAlertDismissed(id: string) {
  try {
    localStorage.setItem(`${DISMISS_PREFIX}${id}`, Date.now().toString());
  } catch {}
}

function pruneDismissedAlerts() {
  const now = Date.now();
  try {
    const expired: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(DISMISS_PREFIX)) {
        const val = localStorage.getItem(key);
        if (val && !(now - parseInt(val, 10) < DISMISS_TTL_MS)) expired.push(key);
      }
    }
    expired.forEach((key) => localStorage.removeItem(key));
  } catch {}
}

export default function TaskAlerts({ unconfirmedCount: propUnconfirmed, pendingProofs: propProofs }: TaskAlertsProps = {}) {
  const { data: rawAlerts } = useSWR<any>('/api/dashboard/alerts', fetcher, { revalidateOnFocus: false, dedupingInterval: 30000 });
  const shouldFetchOverview = propUnconfirmed === undefined && propProofs === undefined;
  const { data: overviewData } = useSWR<any>(shouldFetchOverview ? '/api/dashboard/overview' : null, fetcher, { revalidateOnFocus: false, dedupingInterval: 30000 });

  const [dismissedAlerts, setDismissedAlerts] = useState<string[]>(readDismissedAlerts);
  const isMounted = useSyncExternalStore(noopSubscribe, () => true, () => false);

  // Prune expired dismissals from storage (no state involved).
  useEffect(() => {
    pruneDismissedAlerts();
  }, []);

  const alerts = (Array.isArray(rawAlerts) ? rawAlerts : []).filter((a: any) => !dismissedAlerts.includes(a.id));
  const unconfirmedCount = propUnconfirmed ?? (overviewData?.unconfirmedJobsCount || 0);
  const pendingProofs = propProofs ?? (overviewData?.pendingProofs || 0);

  const handleDismiss = (id: string) => {
    markAlertDismissed(id);
    setDismissedAlerts(prev => [...prev, id]);
  };

  if (!isMounted || (alerts.length === 0 && unconfirmedCount === 0 && pendingProofs === 0)) return null;

  const row = (tint: string) => `flex items-center justify-between gap-3 rounded-2xl border px-3 py-2.5 ${tint}`;
  const actionClass = "inline-flex h-8 shrink-0 items-center rounded-xl bg-white px-3 text-xs font-bold shadow-sm ring-1 transition-colors";
  const tile = (bg: string, icon: string) => (
    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white shadow-md ${bg}`}>
      <i className={`ph-bold ${icon} text-[16px]`} aria-hidden="true"></i>
    </span>
  );

  return (
    <GlassCard icon="ph-bell-ringing" tone="orange" title="Smart alerts & to-dos" subtitle="Things waiting on the shop">
      <div className="flex flex-col gap-2.5">
        {pendingProofs > 0 && (
          <div className={row("border-amber-100 bg-amber-50/70")}>
            <div className="flex min-w-0 items-center gap-3">
              {tile("bg-gradient-to-br from-amber-400 to-orange-500 shadow-amber-500/30", "ph-warning")}
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900">Proofs due</p>
                <p className="num truncate text-xs font-medium text-slate-500">{pendingProofs.toLocaleString('en-IN')} proof deliveries are pending</p>
              </div>
            </div>
            <Link href="/jobs?view=list&focus=active" className={`${actionClass} text-amber-600 ring-amber-100 hover:bg-amber-50`}>View</Link>
          </div>
        )}

        {unconfirmedCount > 0 && (
          <div className={row("border-sky-100 bg-sky-50/70")}>
            <div className="flex min-w-0 items-center gap-3">
              {tile("bg-gradient-to-br from-sky-500 to-indigo-500 shadow-sky-500/30", "ph-clock")}
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900">Jobs to confirm</p>
                <p className="num truncate text-xs font-medium text-slate-500">{unconfirmedCount.toLocaleString('en-IN')} jobs awaiting confirmation</p>
              </div>
            </div>
            <Link href="/jobs?view=list&focus=active" className={`${actionClass} text-sky-600 ring-sky-100 hover:bg-sky-50`}>View all</Link>
          </div>
        )}

        {alerts.map((alert: any) => (
          <div key={alert.id} className={row("border-rose-100 bg-rose-50/70")}>
            <div className="flex min-w-0 items-center gap-3">
              {tile("bg-gradient-to-br from-rose-500 to-red-500 shadow-rose-500/30", "ph-warning-circle")}
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-slate-900">{alert.title}</p>
                <p className="line-clamp-2 text-xs font-medium text-slate-500">{alert.message}</p>
              </div>
            </div>
            <button type="button" onClick={() => handleDismiss(alert.id)} className={`${actionClass} text-slate-500 ring-slate-200 hover:bg-slate-50`}>
              Dismiss
            </button>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}
