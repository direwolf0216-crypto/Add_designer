"use client";

import { useEffect, type ReactNode } from "react";
import { useSWRConfig } from "swr";
// SWR's own cache writer: updates a key's state and re-renders its hooks without marking an
// in-flight request as outdated (so the fresh answer still replaces the saved copy when it lands).
import { createCacheHelper } from "swr/_internal";
import { SAVED_DATA_KEY } from "@/lib/client/appCache";

// Figures the browser fetches itself (forms' layouts, people, teams, settings, job details, lists...)
// are saved for this tab, so after a refresh or reopening the app they show at once and then
// refresh. The Dashboard's and Daily Ledger's first figures come with the page, so they aren't saved.
const SAVED = [
  /^\/api\/settings\//,
  /^\/api\/users(\?|$)/,
  /^\/api\/teams(\?|$)/,
  /^\/api\/roles(\?|$)/,
  /^\/api\/me\//,
  /^\/api\/jobs\/overdue/,
  /^\/api\/jobs\/[^/?#]+$/,
  /^\/api\/transactions(\?|$)/,
  /^\/api\/notifications/,
  /^\/api\/banner/,
  /^\/api\/integrations\/google/,
  /^\/api\/recycle-bin/,
];
const MAX_ENTRY = 300_000; // characters
const MAX_TOTAL = 2_000_000;

/** Restores saved figures just after the page starts, and saves them whenever the tab is hidden or left. */
export default function SavedDataProvider({ children }: { children: ReactNode }) {
  const { cache } = useSWRConfig();

  useEffect(() => {
    // Restore after hydration (restoring during the first render would differ from the server's HTML).
    try {
      const raw = sessionStorage.getItem(SAVED_DATA_KEY);
      if (raw) {
        for (const [key, data] of JSON.parse(raw) as [string, unknown][]) {
          if (typeof key === "string" && SAVED.some((r) => r.test(key)) && cache.get(key)?.data === undefined) {
            // Shown as loaded at once (a list already showing its spinner swaps to the saved rows).
            createCacheHelper(cache, key)[1]({ data, isLoading: false });
          }
        }
      }
    } catch {}

    const save = () => {
      try {
        const out: [string, unknown][] = [];
        let total = 0;
        for (const key of cache.keys()) {
          if (typeof key !== "string" || !SAVED.some((r) => r.test(key))) continue;
          const data = cache.get(key)?.data;
          if (data === undefined) continue;
          const size = JSON.stringify(data).length;
          if (size > MAX_ENTRY || total + size > MAX_TOTAL) continue;
          total += size;
          out.push([key, data]);
        }
        sessionStorage.setItem(SAVED_DATA_KEY, JSON.stringify(out));
      } catch {}
    };
    const onHide = () => {
      if (document.visibilityState === "hidden") save();
    };
    window.addEventListener("pagehide", save);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("pagehide", save);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [cache]);

  return <>{children}</>;
}
