"use client";

import type { ReactNode } from "react";

export interface JobDetailsTab {
  id: string;
  label: string;
  /** Content of the tab, rendered in the scrollable body. */
  render: (jobId: string) => ReactNode;
}

/**
 * Tab bar of the details view. Hidden while "Details" is the only tab, so the view looks unchanged
 * until extra tabs (e.g. an admin-only "Activity" tab) are passed in.
 */
export default function JobTabs({ tabs, activeId, onChange }: { tabs: { id: string; label: string }[]; activeId: string; onChange: (id: string) => void }) {
  if (tabs.length < 2) return null;
  return (
    <div role="tablist" aria-label="Job sections" className="flex items-center gap-1 -mb-4">
      {tabs.map((tab) => {
        const active = tab.id === activeId;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`job-tab-${tab.id}`}
            aria-selected={active}
            aria-controls="job-details-content"
            onClick={() => onChange(tab.id)}
            className={`px-3 py-2 text-sm font-bold border-b-2 transition-colors ${active ? "border-slate-900 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-700"}`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
