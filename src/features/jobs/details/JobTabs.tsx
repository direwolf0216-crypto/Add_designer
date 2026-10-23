"use client";

import type { ReactNode } from "react";
import GlideGroup from "@/components/motion/GlideGroup";

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
    <GlideGroup role="tablist" aria-label="Job sections" active={activeId} pillClassName="border-b-2 border-slate-900" className="flex items-center gap-1 -mb-4">
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
            data-pill-key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`relative z-10 px-3 py-2 text-sm font-bold border-b-2 border-transparent transition-colors duration-300 ${active ? "text-slate-900" : "text-slate-500 hover:text-slate-700"}`}
          >
            {tab.label}
          </button>
        );
      })}
    </GlideGroup>
  );
}
