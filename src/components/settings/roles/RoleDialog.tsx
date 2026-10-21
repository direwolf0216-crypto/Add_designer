"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { RoleSummary } from "@/lib/services/roles";
import { roleIcon } from "../RoleSelect";

/**
 * Create a role, either blank or as a copy of an existing role's permissions ("Duplicate" opens
 * this with the source preselected).
 */
export default function RoleDialog({ roles, from, onClose, onCreated }: { roles: RoleSummary[]; from: RoleSummary | null; onClose: () => void; onCreated: (key: string) => void }) {
  const [name, setName] = useState(from ? `${from.name} copy` : "");
  const [description, setDescription] = useState(from?.kind === "custom" ? from.description ?? "" : "");
  const [source, setSource] = useState<string>(from?.key ?? "");
  const [saving, setSaving] = useState(false);
  const sourceRole = roles.find((r) => r.key === source);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description: description || null, permissions: sourceRole?.permissions ?? [] }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Couldn't create the role");
      toast.success(`Created ${body.role.name}`);
      onCreated(`custom:${body.role.id}`);
    } catch (err) {
      toast.error((err as Error).message);
      setSaving(false);
    }
  };

  const field = "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-orange-300 focus:outline-none focus:ring-4 focus:ring-orange-500/10";

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="!max-w-md !gap-0 !rounded-3xl !p-0">
        <form onSubmit={submit}>
          <div className="border-b border-slate-100 px-6 pt-6 pb-4">
            <DialogTitle className="text-lg font-black text-slate-900">{from ? `Duplicate ${from.name}` : "New role"}</DialogTitle>
            <DialogDescription className="text-sm text-slate-500">
              {from ? "Starts with the same permissions. Change anything after." : "Name it, pick a starting point, then fine-tune its permissions."}
            </DialogDescription>
          </div>

          <div className="flex flex-col gap-4 px-6 py-5">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-bold text-slate-600">Name</span>
              <input autoFocus required maxLength={40} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Designer, Front desk" className={field} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-bold text-slate-600">
                Description <span className="font-medium text-slate-400">(optional)</span>
              </span>
              <input maxLength={200} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What people with this role do" className={field} />
            </label>

            <fieldset className="flex flex-col gap-1.5">
              <legend className="mb-1.5 text-xs font-bold text-slate-600">Start from</legend>
              <div role="radiogroup" className="grid max-h-56 grid-cols-2 gap-1.5 overflow-y-auto">
                {[{ key: "", name: "Blank", kind: "custom" as const, permissions: [] as string[], locked: false }, ...roles].map((r) => {
                  const on = r.key === source;
                  return (
                    <button
                      key={r.key || "blank"}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => setSource(r.key)}
                      className={`flex items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-bold ring-1 transition-colors ${on ? "bg-orange-50 text-slate-900 ring-orange-300" : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50"}`}
                    >
                      <i className={`ph-bold ${r.key ? roleIcon(r) : "ph-file-dashed"} ${on ? "text-orange-500" : "text-slate-400"}`} aria-hidden="true"></i>
                      <span className="min-w-0 flex-1 truncate">{r.name}</span>
                      <span className="text-[11px] font-semibold text-slate-400">{r.locked ? "all" : r.permissions.length}</span>
                    </button>
                  );
                })}
              </div>
            </fieldset>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-6 py-4">
            <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-800">
              Cancel
            </button>
            <button type="submit" disabled={saving || !name.trim()} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-slate-800 disabled:opacity-50">
              {saving && <i className="ph-bold ph-circle-notch animate-spin" aria-hidden="true"></i>}
              {from ? "Duplicate" : "Create role"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
