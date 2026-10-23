"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateJobTrackingAction } from "@/app/actions";
import { usePermissions } from "@/hooks/usePermissions";
import type { WorkspaceData, WorkspaceJob } from "@/lib/jobs/workspace";
import JobCard from "./JobCard";
import { useCardDrag } from "./useCardDrag";
import { stageHex, stageIcon } from "./stageStyle";
import { useWorkspaceUrl } from "./url";
import { CANCELLATION_KEY, isCancelStage } from "@/lib/jobs/cancellation";
import CancelJobDialog from "@/features/jobs/details/CancelJobDialog";

type Column = NonNullable<WorkspaceData["board"]>[number];

/**
 * Kanban board by production stage. Cards can be dragged between columns (or moved via the card menu);
 * the move is applied optimistically and confirmed by the server.
 */
export default function BoardView({ data }: { data: WorkspaceData }) {
  const router = useRouter();
  const { hrefWith } = useWorkspaceUrl();
  const { checkPermission } = usePermissions();
  const canMove = checkPermission("edit_jobs");
  const [, startTransition] = useTransition();

  // Local copy for optimistic moves; re-synced whenever the server sends a new board.
  const [source, setSource] = useState(data.board);
  const [columns, setColumns] = useState<Column[]>(data.board ?? []);
  if (source !== data.board) {
    setSource(data.board);
    setColumns(data.board ?? []);
  }
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const { scrollerRef, onCardPointerDown } = useCardDrag({ onTarget: setDropTarget, onDrop: (jobId, stage) => move(jobId, stage) });
  // Moving a card to a Cancelled column asks for the (optional) cancellation charge first.
  const [cancelling, setCancelling] = useState<{ jobId: string; toStage: string } | null>(null);
  const [cancelBusy, setCancelBusy] = useState(false);

  const move = async (jobId: string, toStage: string, extra?: Record<string, unknown>) => {
    if (isCancelStage(toStage) && !extra) {
      setCancelling({ jobId, toStage });
      return;
    }
    const previous = columns;
    let moved: WorkspaceJob | undefined;
    const next = columns.map((c) => {
      const hit = c.jobs.find((j) => j.id === jobId);
      if (hit) moved = hit;
      return hit ? { ...c, count: c.count - 1, jobs: c.jobs.filter((j) => j.id !== jobId) } : c;
    });
    if (!moved || moved.stage === toStage) return;
    const card = { ...moved, stage: toStage };
    setColumns(next.map((c) => (c.stage === toStage ? { ...c, count: c.count + 1, jobs: [card, ...c.jobs] } : c)));

    const res = await updateJobTrackingAction(jobId, {
      ...(isCancelStage(toStage) || isCancelStage(moved.stage) ? { status: toStage } : {}),
      customData: { fld_b_status: toStage, ...(isCancelStage(toStage) || isCancelStage(moved.stage) ? { fld_b_job_status: toStage } : {}), ...(extra ?? {}), ...(isCancelStage(moved.stage) && !isCancelStage(toStage) ? { [CANCELLATION_KEY]: null } : {}) },
    });
    if (!res.success) {
      setColumns(previous);
      toast.error(res.error || "Couldn't move the job");
      return;
    }
    toast.success(`Moved to ${toStage}`);
    startTransition(() => router.refresh());
  };

  // A team's board (My jobs with a few stages) spreads its columns across the page with bigger cards;
  // the full board keeps fixed columns that scroll sideways.
  const wide = columns.length > 0 && columns.length <= 4;
  const label = (stage: string) => data.stageLabels[stage] ?? stage;

  return (
    <>
    <div
      ref={scrollerRef}
      className={
        wide
          ? "-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 md:mx-0 md:grid md:gap-5 md:overflow-visible md:px-0"
          : "-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 md:mx-0 md:px-0"
      }
      style={wide ? { gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` } : undefined}
    >
      {columns.map((col) => {
        const hex = stageHex(col.color);
        const isTarget = dropTarget === col.stage;
        return (
          <section
            key={col.stage}
            aria-label={`${col.stage}, ${col.count} jobs`}
            data-board-column={col.stage}
            className={`flex w-[290px] shrink-0 snap-start flex-col rounded-3xl border p-3 transition-colors ${wide ? "md:w-auto md:min-w-0 md:p-4" : "md:w-[300px]"} ${isTarget ? "border-dashed bg-white/90" : "border-slate-200/70 bg-slate-50/70 backdrop-blur"}`}
            style={isTarget ? { borderColor: hex } : undefined}
          >
            <header className="mb-3 flex items-center gap-2 px-1">
              <span className={`flex items-center justify-center rounded-lg ${wide ? "h-9 w-9 rounded-xl" : "h-7 w-7"}`} style={{ backgroundColor: `${hex}1a`, color: hex }}>
                <i className={`ph-bold ${stageIcon(col.stage)} ${wide ? "text-base" : "text-sm"}`} aria-hidden="true"></i>
              </span>
              <div className="min-w-0 flex-1">
                <h2 className={`truncate font-extrabold text-slate-800 ${wide ? "text-base" : "text-sm"}`}>{label(col.stage)}</h2>
                {label(col.stage) !== col.stage && <p className="truncate text-[0.65rem] font-semibold text-slate-400">{col.stage}</p>}
              </div>
              <span className="rounded-full bg-white px-2 py-0.5 text-xs font-black text-slate-600 ring-1 ring-slate-200">{col.count}</span>
            </header>

            {/* Room inside the scroller for a card's hover lift and soft shadow (a scroller clips
                whatever reaches past its edge, which drew the shadow as a hard-edged box); the
                negative margins keep the column's layout where it was. */}
            <div className={`-mx-2 -mt-2 -mb-4 flex max-h-[calc(100dvh-22rem+1.5rem)] min-h-[120px] flex-col overflow-y-auto px-2 pt-2 pb-5 ${wide ? "gap-3" : "gap-2.5"}`}>
              {col.jobs.map((job, i) => (
                <div key={job.id} className="animate-rise" style={{ ["--i" as string]: Math.min(i, 8) }}>
                  <JobCard job={job} today={data.today} stages={data.stages} onMove={canMove ? move : undefined} onDragStart={canMove ? (e) => onCardPointerDown(e, job.id, col.stage) : undefined} size={wide ? "lg" : "md"} />
                </div>
              ))}
              {col.jobs.length === 0 && (
                <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 py-8 text-center text-xs font-semibold text-slate-400">
                  <i className="ph-bold ph-tray mb-1 text-lg" aria-hidden="true"></i>
                  {canMove ? "Drop a job here" : "Nothing here"}
                </div>
              )}
              {col.count > col.jobs.length && (
                <Link
                  href={hrefWith({ more: col.expanded ? null : col.stage })}
                  scroll={false}
                  className="rounded-xl py-2 text-center text-xs font-bold text-slate-500 hover:bg-white hover:text-slate-800"
                >
                  {col.expanded ? `Showing ${col.jobs.length} of ${col.count} · use List for all` : `Show more (${col.count - col.jobs.length})`}
                </Link>
              )}
            </div>
          </section>
        );
      })}
    </div>
      {cancelling && (() => {
        const target = columns.flatMap((c) => c.jobs).find((j) => j.id === cancelling.jobId);
        return (
          <CancelJobDialog
            open
            onOpenChange={(o) => { if (!o) setCancelling(null); }}
            clientName={target?.clientName || "This client"}
            advance={target?.paid ?? 0}
            showAmounts={data.canSeeAmounts}
            busy={cancelBusy}
            onConfirm={async (input) => {
              setCancelBusy(true);
              await move(cancelling.jobId, cancelling.toStage, { [CANCELLATION_KEY]: { ...input, at: new Date().toISOString() } });
              setCancelBusy(false);
              setCancelling(null);
            }}
          />
        );
      })()}
    </>
  );
}