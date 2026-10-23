"use client";

import { ViewTransition } from "react";
import Link from "next/link";
import EmptyState from "@/components/ui/empty-state";
import type { WorkspaceData } from "@/lib/jobs/workspace";
import WorkspaceHeader from "./WorkspaceHeader";
import StatsStrip from "./StatsStrip";
import BoardView from "./BoardView";
import ListView from "./ListView";
import ScheduleView from "./ScheduleView";
import QueueView from "./QueueView";
import { useWorkspaceUrl } from "./url";

/** Shown instead of a board of empty columns / an empty table. */
function NoJobs({ data }: { data: WorkspaceData }) {
  const { hrefWith } = useWorkspaceUrl();
  const { params } = data;
  const narrowed = Boolean(params.q || params.stages.length || params.categories.length || params.assignee || params.from || params.to || params.focus);
  const link = "inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-slate-800";
  if (narrowed) {
    return (
      <EmptyState
        icon="ph-funnel-x"
        title="No jobs match"
        description="Try a different search or loosen the filters."
        action={<Link href={hrefWith({ q: null, stages: null, categories: null, assignee: null, from: null, to: null, focus: null, more: null, page: null })} scroll={false} className={link}>Reset filters</Link>}
      />
    );
  }
  return (
    <EmptyState
      icon="ph-tray"
      title={params.scope === "mine" ? "Nothing assigned to you yet" : "No jobs yet"}
      description={params.scope === "mine" ? "Jobs show up here as soon as someone assigns you." : "New jobs will appear here."}
      action={data.canSeeAll && params.scope === "mine" ? <Link href={hrefWith({ scope: null })} scroll={false} className={link}>Browse all jobs</Link> : undefined}
    />
  );
}

/** The Jobs workspace: one page for my/all jobs with board, list and schedule views. */
export default function JobsWorkspace({ data }: { data: WorkspaceData }) {
  const { view } = data.params;
  const empty = (view === "board" && data.board?.every((c) => c.count === 0)) || (view === "list" && data.list?.total === 0);
  return (
    <div className="flex flex-col gap-5">
      <WorkspaceHeader data={data} />
      <StatsStrip data={data} />
      {/* Switching views crossfades; filtering within a view just updates in place. */}
      <ViewTransition key={view} enter="page-enter" exit="page-exit" default="none">
        <div data-nav-dim="jobs-view">
          {empty && <NoJobs data={data} />}
          {!empty && view === "board" && <BoardView data={data} />}
          {!empty && view === "list" && <ListView data={data} />}
          {view === "schedule" && <ScheduleView data={data} />}
          {view === "queue" && <QueueView data={data} />}
        </div>
      </ViewTransition>
    </div>
  );
}
