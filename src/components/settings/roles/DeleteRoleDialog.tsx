"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { RoleSummary } from "@/lib/services/roles";
import { roleIcon } from "../RoleSelect";

/** Delete a custom role; anyone still holding it is moved to the chosen role in the same request. */
export default function DeleteRoleDialog({ role, roles, onClose, onDeleted }: { role: RoleSummary; roles: RoleSummary[]; onClose: () => void; onDeleted: () => void }) {
  const targets = roles.filter((r) => r.key === "MANAGER" || r.key === "STAFF" || (r.kind === "custom" && r.key !== role.key));
  const [moveTo, setMoveTo] = useState("STAFF");
  const [busy, setBusy] = useState(false);

  const remove = async () => {
    setBusy(true);
    try {
      const qs = role.userCount ? `?reassignTo=${encodeURIComponent(moveTo)}` : "";
      const res = await fetch(`/api/roles/${role.id}${qs}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error || "Couldn't delete the role");
      toast.success(`Deleted ${role.name}`);
      onDeleted();
    } catch (err) {
      toast.error((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="!max-w-sm !gap-4 !rounded-3xl !p-6">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-50 text-rose-500">
          <i className="ph-bold ph-trash text-xl" aria-hidden="true"></i>
        </span>
        <div>
          <DialogTitle className="text-lg font-black text-slate-900">Delete {role.name}?</DialogTitle>
          <DialogDescription className="mt-1 text-sm text-slate-500">
            {role.userCount
              ? `${role.userCount} ${role.userCount === 1 ? "person has" : "people have"} this role. Choose where they move.`
              : "Nobody has this role, so nothing else changes."}
          </DialogDescription>
        </div>

        {role.userCount > 0 && (
          <div role="radiogroup" aria-label="Move people to" className="flex flex-col gap-1.5">
            {targets.map((r) => {
              const on = moveTo === r.key;
              return (
                <button
                  key={r.key}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setMoveTo(r.key)}
                  className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-bold ring-1 transition-colors ${on ? "bg-orange-50 ring-orange-300" : "ring-slate-200 hover:bg-slate-50"}`}
                >
                  <i className={`ph-bold ${roleIcon(r)} ${on ? "text-orange-500" : "text-slate-400"}`} aria-hidden="true"></i>
                  <span className="flex-1 text-slate-800">{r.name}</span>
                  {on && <i className="ph-bold ph-check text-xs text-orange-500" aria-hidden="true"></i>}
                </button>
              );
            })}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-800">
            Cancel
          </button>
          <button type="button" onClick={remove} disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-rose-700 disabled:opacity-50">
            {busy && <i className="ph-bold ph-circle-notch animate-spin" aria-hidden="true"></i>}
            Delete role
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
