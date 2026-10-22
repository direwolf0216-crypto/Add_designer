"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { reorderQueueAction, setJobPriorityAction, updateJobTrackingAction } from "@/app/actions";
import { usePermissions } from "@/hooks/usePermissions";
import EmptyState from "@/components/ui/empty-state";
import AssigneeAvatars from "@/features/jobs/assignees/AssigneeAvatars";
import type { WorkspaceData, WorkspaceJob } from "@/lib/jobs/workspace";
import { PRIORITY_STYLE, type Priority } from "@/lib/jobs/priority";
import { groupQueue, moveInQueue } from "@/lib/jobs/queueOrder";
import DueChip from "./DueChip";
import PriorityPicker from "./PriorityPicker";
import StageBadge from "./StageBadge";
import { stageHex, stageIcon } from "./stageStyle";
import { useWorkspaceUrl } from "./url";

type Queue = NonNullable<WorkspaceData["queue"]>;
type Drop = { priority: Priority; index: number } | null;

const lower = (s: string) => s.toLowerCase();

/**
 * A team's work queue: jobs in the team's stages, grouped by priority and in hand-set order. Rows drag
 * within and between priority groups (or move with the arrows); the order is saved for everyone.
 */
export default function QueueView({ data }: { data: WorkspaceData }) {
  const queue = data.queue as Queue;
  const router = useRouter();
  const { hrefWith } = useWorkspaceUrl();
  const { checkPermission, isAdmin } = usePermissions();
  const canEdit = checkPermission("edit_jobs");
  const canReorder = canEdit && !queue.narrowed;
  const [, startTransition] = useTransition();

  // Local copy for optimistic changes; re-synced whenever the server sends a new queue.
  const [source, setSource] = useState(queue.jobs);
  const [items, setItems] = useState(queue.jobs);
  if (source !== queue.jobs) {
    setSource(queue.jobs);
    setItems(queue.jobs);
  }
  const [dragId, setDragId] = useState<string | null>(null);
  const [drop, setDrop] = useState<Drop>(null);

  const refresh = () => startTransition(() => router.refresh());

  if (!queue.team) {
    return (
      <EmptyState
        icon="ph-users-four"
        title="No teams yet"
        description="Make a Printing team that takes over jobs at Designing Completed, and finished designs line up here automatically."
        action={
          isAdmin ? (
            <Link href="/settings?section=teams" className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-slate-800">
              <i className="ph-bold ph-plus" aria-hidden="true"></i>
              Set up teams
            </Link>
          ) : undefined
        }
      />
    );
  }
  const team = queue.team;

  const save = async (next: WorkspaceJob[], message: string) => {
    const previous = items;
    setItems(next);
    const res = await reorderQueueAction(team.id, next.map((j) => ({ id: j.id, priority: j.priority })));
    if (!res.success) {
      setItems(previous);
      toast.error(res.error || "Couldn't save the order");
      return;
    }
    toast.success(message);
    refresh();
  };

  const moveTo = (id: string, priority: Priority, index: number) => {
    const job = items.find((j) => j.id === id);
    if (!job) return;
    const next = moveInQueue(items, id, priority, index);
    if (next.map((j) => j.id + j.priority).join() === items.map((j) => j.id + j.priority).join()) return;
    save(next, job.priority === priority ? "Queue order saved" : `${job.clientName} is now ${PRIORITY_STYLE[priority].label}`);
  };

  const changePriority = async (job: WorkspaceJob, priority: Priority) => {
    if (job.priority === priority) return;
    const previous = items;
    setItems(moveInQueue(items, job.id, priority, Infinity));
    const res = await setJobPriorityAction(job.id, priority);
    if (!res.success) {
      setItems(previous);
      toast.error(res.error || "Couldn't change the priority");
      return;
    }
    toast.success(`${job.clientName} is now ${PRIORITY_STYLE[priority].label}`);
    refresh();
  };

  // The next board stage, e.g. Designing Completed → Printing → Ready for Delivery.
  const nextStage = (stage: string) => {
    const open = data.stages.filter((s) => !/cancel/i.test(s.label));
    const i = open.findIndex((s) => lower(s.label) === lower(stage));
    return i >= 0 ? open[i + 1]?.label : undefined;
  };

  const advance = async (job: WorkspaceJob, to: string) => {
    const previous = items;
    const staysHere = team.stages.some((s) => lower(s) === lower(to));
    setItems(staysHere ? items.map((j) => (j.id === job.id ? { ...j, stage: to } : j)) : items.filter((j) => j.id !== job.id));
    const res = await updateJobTrackingAction(job.id, { customData: { fld_b_status: to } });
    if (!res.success) {
      setItems(previous);
      toast.error(res.error || "Couldn't move the job");
      return;
    }
    toast.success(`${job.clientName} moved to ${to}`);
    refresh();
  };

  const groups = groupQueue(items);
  const stageColor = (label: string) => data.stages.find((s) => lower(s.label) === lower(label))?.color;
  let place = 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Team switcher + what the team is holding */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Team" className="inline-flex flex-wrap gap-1 rounded-2xl bg-slate-900/5 p-1 ring-1 ring-slate-900/5">
          {queue.teams.map((t) => {
            const active = t.id === team.id;
            return (
              <Link
                key={t.id}
                role="tab"
                aria-selected={active}
                href={hrefWith({ team: t.id })}
                scroll={false}
                className={`inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm font-bold transition-all ${active ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: t.color }} />
                {t.name}
              </Link>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-2">
          {team.stages.map((s) => {
            const hex = stageHex(stageColor(s));
            const count = queue.stageCounts[s] ?? 0;
            return (
              <span key={s} className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm ring-1 ring-slate-200">
                <i className={`ph-bold ${stageIcon(s)}`} style={{ color: hex }} aria-hidden="true"></i>
                {data.stageLabels[s] ?? s}
                <span className="rounded-full px-1.5 text-[0.65rem] font-black text-white" style={{ backgroundColor: hex }}>{count}</span>
              </span>
            );
          })}
        </div>
      </div>

      {queue.narrowed && canEdit && (
        <p className="flex items-center gap-2 rounded-2xl bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-800 ring-1 ring-amber-100">
          <i className="ph-bold ph-info" aria-hidden="true"></i>
          Filters are on, so reordering is paused. Clear them to reorder the queue.
        </p>
      )}

      {items.length === 0 ? (
        <EmptyState
          icon="ph-coffee"
          title={`The ${team.name} queue is empty`}
          description={team.stages.length ? `Jobs show up here as soon as they reach ${team.stages.join(" or ")}.` : "This team has no stages yet. Pick them in Settings → Teams."}
        />
      ) : (
        groups.map((g) => {
          const style = PRIORITY_STYLE[g.priority];
          const dropHere = drop?.priority === g.priority;
          // Empty Urgent/High/Low groups only appear while dragging, as drop targets.
          if (!g.items.length && !dragId) return null;
          return (
            <section
              key={g.priority}
              aria-label={`${style.label} priority, ${g.items.length} jobs`}
              onDragOver={(e) => {
                if (!dragId) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (!g.items.length) setDrop({ priority: g.priority, index: 0 });
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragId && drop) {
                  // The drop index counts the dragged row; moving down within its own group skips it.
                  const from = g.items.findIndex((j) => j.id === dragId);
                  moveTo(dragId, drop.priority, from >= 0 && from < drop.index ? drop.index - 1 : drop.index);
                }
                setDragId(null);
                setDrop(null);
              }}
              className={`rounded-3xl border p-2 transition-colors ${dropHere ? "border-dashed bg-white" : "border-slate-200/70 bg-slate-50/70"}`}
              style={dropHere ? { borderColor: style.hex } : undefined}
            >
              <header className="flex items-center gap-2 px-2 pb-2 pt-1">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ backgroundColor: `${style.hex}1a`, color: style.hex }}>
                  <i className={`ph-bold ${style.icon} text-sm`} aria-hidden="true"></i>
                </span>
                <h2 className="text-sm font-extrabold text-slate-800">{style.label}</h2>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-black text-slate-600 ring-1 ring-slate-200">{g.items.length}</span>
              </header>

              {!g.items.length && (
                <div className="rounded-2xl border border-dashed border-slate-200 py-4 text-center text-xs font-semibold text-slate-400">Drop here to make it {style.label}</div>
              )}

              <ol className="flex flex-col gap-1.5">
                {g.items.map((job, i) => {
                  place += 1;
                  const next = nextStage(job.stage);
                  const indicator = drop && drop.priority === g.priority && dragId !== job.id ? (drop.index === i ? "before" : drop.index === i + 1 && i === g.items.length - 1 ? "after" : null) : null;
                  return (
                    <li
                      key={job.id}
                      draggable={canReorder}
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/job-id", job.id);
                        e.dataTransfer.effectAllowed = "move";
                        setDragId(job.id);
                      }}
                      onDragEnd={() => {
                        setDragId(null);
                        setDrop(null);
                      }}
                      onDragOver={(e) => {
                        if (!dragId) return;
                        e.preventDefault();
                        const box = e.currentTarget.getBoundingClientRect();
                        const index = e.clientY < box.top + box.height / 2 ? i : i + 1;
                        if (drop?.priority !== g.priority || drop.index !== index) setDrop({ priority: g.priority, index });
                      }}
                      className={`group relative flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-slate-200/80 bg-white px-3 py-2.5 shadow-[0_4px_16px_-12px_rgba(15,23,42,0.3)] transition-[opacity,box-shadow,transform] duration-150 hover:shadow-[0_12px_26px_-16px_rgba(15,23,42,0.4)] ${dragId === job.id ? "opacity-40" : ""} ${canReorder ? "cursor-grab active:cursor-grabbing" : ""}`}
                    >
                      {indicator && (
                        <span className={`pointer-events-none absolute inset-x-3 h-0.5 rounded-full ${indicator === "before" ? "-top-1" : "-bottom-1"}`} style={{ backgroundColor: style.hex }} aria-hidden="true" />
                      )}
                      <span className="flex w-8 shrink-0 items-center gap-1 text-slate-300">
                        {canReorder && <i className="ph-bold ph-dots-six-vertical text-base" aria-hidden="true"></i>}
                        <span className="font-mono text-xs font-black text-slate-400">{place}</span>
                      </span>

                      <Link href={`/jobs/details/${job.id}`} className="min-w-[10rem] flex-1 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400">
                        <p className="font-mono text-[0.65rem] font-bold tracking-wide text-slate-400">{job.jobNumber ?? `#${job.id.slice(-6).toUpperCase()}`}</p>
                        <p className="truncate text-sm font-extrabold text-slate-900">
                          {job.clientName}
                          <span className="font-semibold text-slate-400"> · {job.category || "Uncategorised"}</span>
                        </p>
                      </Link>

                      <div className="flex flex-wrap items-center gap-2">
                        <StageBadge stage={data.stageLabels[job.stage] ?? job.stage} color={stageColor(job.stage)} size="xs" />
                        <DueChip due={job.dueDate} today={data.today} />
                        <AssigneeAvatars assignees={job.assignees.map((a) => ({ ...a, user: { ...a.user, image: a.user.image ?? undefined } }))} size={22} />
                      </div>

                      {canEdit && (
                        <div className="flex items-center gap-1">
                          <PriorityPicker value={job.priority} onChange={(p) => changePriority(job, p)} compact />
                          {canReorder && (
                            <>
                              <button
                                type="button"
                                aria-label="Move up"
                                disabled={i === 0}
                                onClick={() => moveTo(job.id, g.priority, i - 1)}
                                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-30 disabled:hover:bg-transparent"
                              >
                                <i className="ph-bold ph-caret-up" aria-hidden="true"></i>
                              </button>
                              <button
                                type="button"
                                aria-label="Move down"
                                disabled={i === g.items.length - 1}
                                onClick={() => moveTo(job.id, g.priority, i + 1)}
                                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-30 disabled:hover:bg-transparent"
                              >
                                <i className="ph-bold ph-caret-down" aria-hidden="true"></i>
                              </button>
                            </>
                          )}
                          {next && (
                            <button
                              type="button"
                              onClick={() => advance(job, next)}
                              className="ml-1 inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold text-white shadow-sm transition-[filter] hover:brightness-110"
                              style={{ backgroundColor: stageHex(stageColor(next)) }}
                            >
                              <i className={`ph-bold ${stageIcon(next)}`} aria-hidden="true"></i>
                              {data.stageLabels[next] ?? next}
                            </button>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
            </section>
          );
        })
      )}
      {queue.total > items.length && (
        <p className="text-center text-xs font-semibold text-slate-400">
          Showing the top {items.length} of {queue.total.toLocaleString("en-IN")} jobs. The rest keep their order below.
        </p>
      )}
    </div>
  );
}
