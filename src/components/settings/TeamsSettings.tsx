"use client";

import { useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { fetcher } from "@/lib/swr";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useConfirm } from "@/components/ui/confirm-dialog";
import MultiUserPicklist, { type UserItem } from "@/components/ui/MultiUserPicklist";
import type { TeamSummary } from "@/lib/services/teams";
import type { StageOption } from "@/lib/jobs/tracking";
import { stageHex, stageIcon } from "@/features/jobs/workspace/stageStyle";

type TeamsResponse = { teams: TeamSummary[]; stages: StageOption[] };
type ApiUser = { id: string; name: string | null; email?: string | null; image?: string | null; role: string; roleName?: string; status: string };

const COLORS = ["#3b82f6", "#8b5cf6", "#ec4899", "#f97316", "#eab308", "#10b981", "#06b6d4", "#64748b"];
const lower = (s: string) => s.toLowerCase();

const initials = (name: string) =>
  name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

function MemberStack({ members }: { members: TeamSummary["members"] }) {
  if (!members.length) return <span className="text-xs font-semibold text-slate-400">No one yet</span>;
  return (
    <div className="flex items-center">
      {members.slice(0, 6).map((m, i) => {
        const name = m.name || m.email || "User";
        return m.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={m.id} src={m.image} alt={name} title={name} className={`h-8 w-8 rounded-full border-2 border-white object-cover shadow-sm ${i ? "-ml-2" : ""}`} />
        ) : (
          <span key={m.id} title={name} className={`flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-slate-100 text-[0.65rem] font-black text-slate-600 shadow-sm ${i ? "-ml-2" : ""}`}>
            {initials(name)}
          </span>
        );
      })}
      {members.length > 6 && <span className="-ml-2 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-slate-900 text-[0.65rem] font-black text-white">+{members.length - 6}</span>}
    </div>
  );
}

function TeamDialog({
  team,
  teams,
  stages,
  users,
  onClose,
  onSaved,
}: {
  team: TeamSummary | null;
  teams: TeamSummary[];
  stages: StageOption[];
  users: UserItem[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(team?.name ?? "");
  const [color, setColor] = useState(team?.color ?? COLORS[teams.length % COLORS.length]);
  const [picked, setPicked] = useState<string[]>(team?.stages ?? []);
  const [members, setMembers] = useState((team?.members ?? []).map((m) => m.id).join(","));
  const [busy, setBusy] = useState(false);

  // Each stage belongs to one team, so a job always has exactly one queue.
  const ownerOf = (stage: string) => teams.find((t) => t.id !== team?.id && t.stages.some((s) => lower(s) === lower(stage)));
  const toggle = (stage: string) => setPicked((cur) => (cur.some((s) => lower(s) === lower(stage)) ? cur.filter((s) => lower(s) !== lower(stage)) : [...cur, stage]));

  const save = async () => {
    if (!name.trim()) {
      toast.error("Give the team a name");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(team ? `/api/teams/${team.id}` : "/api/teams", {
        method: team ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, color, stages: picked, memberIds: members.split(",").filter(Boolean) }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Couldn't save the team");
      toast.success(team ? `Saved ${name.trim()}` : `Created the ${name.trim()} team`);
      onSaved();
    } catch (err) {
      toast.error((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="!max-w-lg !gap-5 !rounded-3xl !p-6">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl text-white shadow-lg" style={{ backgroundColor: color, boxShadow: `0 10px 24px -10px ${color}` }}>
            <i className="ph-bold ph-users-three text-xl" aria-hidden="true"></i>
          </span>
          <div>
            <DialogTitle className="text-lg font-black text-slate-900">{team ? `Edit ${team.name}` : "New team"}</DialogTitle>
            <DialogDescription className="text-sm text-slate-500">Jobs that reach this team&apos;s stages join its queue, and the team is notified.</DialogDescription>
          </div>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-[0.8rem] font-bold text-slate-700">Team name</span>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            placeholder="e.g. Printing"
            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-slate-800 shadow-sm transition-all placeholder:text-slate-400 focus:border-orange-400 focus:outline-none focus:ring-4 focus:ring-orange-500/10"
          />
        </label>

        <div className="flex flex-col gap-1.5">
          <span className="text-[0.8rem] font-bold text-slate-700">Colour</span>
          <div role="radiogroup" aria-label="Team colour" className="flex flex-wrap gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={c === color}
                aria-label={c}
                onClick={() => setColor(c)}
                className={`h-8 w-8 rounded-full transition-transform hover:scale-110 ${c === color ? "ring-2 ring-offset-2" : ""}`}
                style={{ backgroundColor: c, ["--tw-ring-color" as string]: c }}
              />
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-[0.8rem] font-bold text-slate-700">Takes over jobs at</span>
          <div className="flex flex-wrap gap-2">
            {stages.map((s) => {
              const owner = ownerOf(s.label);
              const on = picked.some((p) => lower(p) === lower(s.label));
              const hex = stageHex(s.color);
              return (
                <button
                  key={s.label}
                  type="button"
                  aria-pressed={on}
                  disabled={!!owner}
                  onClick={() => toggle(s.label)}
                  title={owner ? `Belongs to the ${owner.name} team` : undefined}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold ring-1 transition-all disabled:cursor-not-allowed disabled:opacity-40 ${on ? "shadow-sm" : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50"}`}
                  style={on ? { backgroundColor: `${hex}14`, color: hex, ["--tw-ring-color" as string]: `${hex}55` } : undefined}
                >
                  <i className={`ph-bold ${on ? "ph-check" : stageIcon(s.label)}`} aria-hidden="true"></i>
                  {s.label}
                  {owner && <span className="font-semibold">· {owner.name}</span>}
                </button>
              );
            })}
          </div>
          <span className="text-[0.7rem] text-slate-400">For a printing team, pick Designing Completed (waiting to print) and Printing.</span>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-[0.8rem] font-bold text-slate-700">People</span>
          <MultiUserPicklist users={users} value={members} onChange={setMembers} placeholder="Add people to the team…" />
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-800">
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-slate-800 disabled:opacity-50"
          >
            {busy && <i className="ph-bold ph-circle-notch animate-spin" aria-hidden="true"></i>}
            {team ? "Save team" : "Create team"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Settings → Teams: groups of people that take over jobs at chosen stages (Design → Printing). */
export default function TeamsSettings() {
  const { data, mutate, isLoading } = useSWR<TeamsResponse>("/api/teams", fetcher, { revalidateOnFocus: false });
  const { data: apiUsers } = useSWR<ApiUser[]>("/api/users", fetcher, { revalidateOnFocus: false });
  const confirm = useConfirm();
  const [editing, setEditing] = useState<TeamSummary | "new" | null>(null);

  const teams = data?.teams ?? [];
  const stages = data?.stages ?? [];
  const users: UserItem[] = (apiUsers ?? [])
    .filter((u) => u.status === "ACTIVE")
    .map((u) => ({ id: u.id, name: u.name || u.email || "User", image: u.image, role: u.role, roleName: u.roleName }));
  const stageColor = (label: string) => stageHex(stages.find((s) => lower(s.label) === lower(label))?.color);

  const remove = async (team: TeamSummary) => {
    const ok = await confirm({
      title: `Delete the ${team.name} team?`,
      description: "Its jobs stay where they are on the board; they just stop showing in a team queue.",
      confirmLabel: "Delete team",
      tone: "danger",
      icon: "ph-trash",
    });
    if (!ok) return;
    const res = await fetch(`/api/teams/${team.id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error((await res.json().catch(() => ({}))).error || "Couldn't delete the team");
      return;
    }
    toast.success(`Deleted ${team.name}`);
    mutate();
  };

  return (
    <div className="animate-[fadeIn_0.3s_ease-out] rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h2 className="mb-1 text-[1.15rem] font-bold text-slate-900">Teams</h2>
          <p className="text-sm text-slate-500">When a job reaches a team&apos;s stage it moves into that team&apos;s queue, so design hands over to printing automatically.</p>
        </div>
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-pink-500 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-orange-500/25 transition-[filter,box-shadow] hover:shadow-xl hover:brightness-105"
        >
          <i className="ph-bold ph-plus" aria-hidden="true"></i>
          New team
        </button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1].map((i) => <div key={i} className="h-40 animate-pulse rounded-2xl bg-slate-100" />)}
        </div>
      ) : teams.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-12 text-center">
          <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-orange-500 shadow-sm ring-1 ring-slate-100">
            <i className="ph-bold ph-users-three text-2xl" aria-hidden="true"></i>
          </span>
          <h3 className="text-sm font-bold text-slate-900">No teams yet</h3>
          <p className="mt-1 max-w-sm text-sm text-slate-500">Make a Design team for Pending and Designing, and a Printing team for Designing Completed and Printing.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {teams.map((t) => (
            <section key={t.id} className="relative overflow-hidden rounded-2xl border border-slate-100 bg-slate-50/50 p-5">
              <div className="pointer-events-none absolute -right-10 -top-12 h-32 w-32 rounded-full opacity-25 blur-2xl" style={{ backgroundColor: t.color }} aria-hidden="true" />
              <div className="relative flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-md" style={{ backgroundColor: t.color }}>
                    <i className="ph-bold ph-users-three text-lg" aria-hidden="true"></i>
                  </span>
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-black text-slate-900">{t.name}</h3>
                    <p className="text-xs font-semibold text-slate-500">
                      {t.members.length} {t.members.length === 1 ? "person" : "people"}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button type="button" onClick={() => setEditing(t)} aria-label={`Edit ${t.name}`} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-white hover:text-slate-900">
                    <i className="ph-bold ph-pencil-simple" aria-hidden="true"></i>
                    <span className="sr-only sm:not-sr-only">Edit</span>
                  </button>
                  <button type="button" onClick={() => remove(t)} aria-label={`Delete ${t.name}`} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50">
                    <i className="ph-bold ph-trash" aria-hidden="true"></i>
                    <span className="sr-only sm:not-sr-only">Delete</span>
                  </button>
                </div>
              </div>
              <div className="relative mt-4 flex flex-wrap gap-1.5">
                {t.stages.length ? (
                  t.stages.map((s) => (
                    <span key={s} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[0.7rem] font-bold" style={{ color: stageColor(s), backgroundColor: `${stageColor(s)}14` }}>
                      <i className={`ph-bold ${stageIcon(s)}`} aria-hidden="true"></i>
                      {s}
                    </span>
                  ))
                ) : (
                  <span className="text-xs font-semibold text-amber-600">No stages yet, so no jobs reach this team</span>
                )}
              </div>
              <div className="relative mt-4">
                <MemberStack members={t.members} />
              </div>
            </section>
          ))}
        </div>
      )}

      {editing && (
        <TeamDialog
          team={editing === "new" ? null : editing}
          teams={teams}
          stages={stages}
          users={users}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            mutate();
          }}
        />
      )}
    </div>
  );
}
