"use client";

import { useCallback } from "react";
import { useSWRConfig } from "swr";

// When a sidebar link is hovered, focused or touched, start loading that page's data into the SWR
// cache, so the page opens with its figures instead of the printer loader. The page still
// revalidates on mount, so what it shows is never older than this head start.

/** The Daily Ledger's year-to-date overview key (must match useTransactionsOverview). */
export function ledgerOverviewKey(today = new Date()) {
  return `/api/transactions/overview?startDate=${new Date(today.getFullYear(), 0, 1).toISOString()}`;
}

/** The dashboard's default (this month) key (must match the dashboard page). */
export const DASHBOARD_OVERVIEW_KEY = "/api/dashboard/overview";

const inFlight = new Set<string>();

async function getJson(url: string) {
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok || data?.error) throw new Error(data?.error || "Failed to fetch");
  return data;
}

/** Returns `warm(path)`: starts loading the data behind one of the sidebar's pages, once. */
export function useWarmPageData() {
  const { cache, mutate } = useSWRConfig();
  return useCallback(
    (path: string) => {
      const key = path.startsWith("/dashboard") ? DASHBOARD_OVERVIEW_KEY : path.startsWith("/transactions/overview") ? ledgerOverviewKey() : null;
      if (!key || inFlight.has(key) || cache.get(key)?.data !== undefined) return;
      inFlight.add(key);
      mutate(key, getJson(key), { revalidate: false })
        .catch(() => {})
        .finally(() => inFlight.delete(key));
    },
    [cache, mutate]
  );
}
