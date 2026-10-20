"use client";
import React, { useState, useEffect, useSyncExternalStore } from "react";
import useSWR from "swr";
import Link from "next/link";

import { fetcher } from "@/lib/swr";

interface TaskAlertsProps {
  unconfirmedCount?: number;
  pendingRetouch?: number;
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

export default function TaskAlerts({ unconfirmedCount: propUnconfirmed, pendingRetouch: propRetouch }: TaskAlertsProps = {}) {
  const { data: rawAlerts } = useSWR<any>('/api/dashboard/alerts', fetcher, { revalidateOnFocus: false, dedupingInterval: 30000 });
  const shouldFetchOverview = propUnconfirmed === undefined && propRetouch === undefined;
  const { data: overviewData } = useSWR<any>(shouldFetchOverview ? '/api/dashboard/overview' : null, fetcher, { revalidateOnFocus: false, dedupingInterval: 30000 });

  const [dismissedAlerts, setDismissedAlerts] = useState<string[]>(readDismissedAlerts);
  const isMounted = useSyncExternalStore(noopSubscribe, () => true, () => false);

  // Prune expired dismissals from storage (no state involved).
  useEffect(() => {
    pruneDismissedAlerts();
  }, []);

  const alerts = (Array.isArray(rawAlerts) ? rawAlerts : []).filter((a: any) => !dismissedAlerts.includes(a.id));
  const unconfirmedCount = propUnconfirmed ?? (overviewData?.unconfirmedJobsCount || 0);
  const pendingRetouch = propRetouch ?? (overviewData?.pendingRetouch || 0);

  const handleDismiss = (id: string) => {
    markAlertDismissed(id);
    setDismissedAlerts(prev => [...prev, id]);
  };

  if (!isMounted || (alerts.length === 0 && unconfirmedCount === 0 && pendingRetouch === 0)) return null;

  return (
    <div className="bg-white rounded-[20px] p-5 md:p-6 border border-gray-100 shadow-sm mb-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-8 h-8 rounded-full bg-orange-50 text-orange-500 flex items-center justify-center">
          <i className="ph-fill ph-bell-ringing text-[1.1rem]"></i>
        </div>
        <h3 className="text-[1.1rem] font-extrabold text-slate-900 tracking-tight">Smart Alerts & To-Dos</h3>
      </div>

      <div className="flex flex-col gap-3">
        {pendingRetouch > 0 && (
          <div className="bg-orange-50/50 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-sm border border-orange-100/50 transition-all hover:bg-orange-50">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-orange-500 text-white flex items-center justify-center shadow-md shadow-orange-500/20 shrink-0">
                <i className="ph-bold ph-warning text-lg"></i>
              </div>
              <div>
                <p className="text-[0.95rem] font-bold text-slate-900">Deliverables Due</p>
                <p className="text-[0.8rem] font-medium text-slate-500">{pendingRetouch} gallery deliveries are pending</p>
              </div>
            </div>
            <Link href="/jobs/allJobs" className="shrink-0 px-4 py-1.5 rounded-lg border border-orange-200 text-orange-500 text-[0.75rem] font-bold hover:bg-orange-50 transition-colors">
              View All
            </Link>
          </div>
        )}

        {unconfirmedCount > 0 && (
          <div className="bg-blue-50/50 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-sm border border-blue-100/50 transition-all hover:bg-blue-50">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0">
                <i className="ph-bold ph-info text-lg"></i>
              </div>
              <div>
                <p className="text-[0.95rem] font-bold text-slate-900">Pending Jobs</p>
                <p className="text-[0.8rem] font-medium text-slate-500">{unconfirmedCount} jobs awaiting confirmation</p>
              </div>
            </div>
            <Link href="/jobs/allJobs" className="shrink-0 px-4 py-1.5 rounded-lg border border-blue-200 text-blue-500 text-[0.75rem] font-bold hover:bg-blue-50 transition-colors">
              View All
            </Link>
          </div>
        )}

        {alerts.map((alert: any) => (
          <div key={alert.id} className="bg-red-50/50 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-sm border border-red-100/50 transition-all hover:bg-red-50">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-red-500 text-white flex items-center justify-center shadow-md shadow-red-500/20 shrink-0">
                <i className="ph-bold ph-warning-circle text-lg"></i>
              </div>
              <div>
                <p className="text-[0.95rem] font-bold text-slate-900 leading-tight">{alert.title}</p>
                <p className="text-[0.8rem] font-medium text-slate-500 mt-0.5">{alert.message}</p>
              </div>
            </div>
            <button 
              onClick={() => handleDismiss(alert.id)}
              className="shrink-0 px-4 py-1.5 rounded-lg border border-red-200 text-red-500 text-[0.75rem] font-bold hover:bg-red-50 transition-colors"
            >
              Dismiss
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
