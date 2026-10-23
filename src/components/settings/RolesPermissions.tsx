"use client";

import GlideGroup from "@/components/motion/GlideGroup";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PERMISSIONS, type Permission } from "@/lib/permissions";
import type { RoleSummary } from "@/lib/services/roles";
import { roleIcon, useRoles } from "./RoleSelect";
import PermissionList from "./roles/PermissionList";
import RoleDialog from "./roles/RoleDialog";
import DeleteRoleDialog from "./roles/DeleteRoleDialog";

type Draft = { name: string; description: string; permissions: Permission[] };

const draftOf = (r: RoleSummary): Draft => ({ name: r.name, description: r.description ?? "", permissions: [...r.permissions] });
const sameDraft = (a: Draft, b: Draft) =>
  a.name.trim() === b.name.trim() && a.description.trim() === b.description.trim() && a.permissions.length === b.permissions.length && a.permissions.every((p) => b.permissions.includes(p));

function RoleItem({ r, on, onSelect }: { r: RoleSummary; on: boolean; onSelect: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-current={on}
        data-pill-key={r.key}
        className={`relative z-10 flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors duration-300 ${on ? "text-white" : "text-slate-700 hover:bg-slate-100/80"}`}
      >
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-colors duration-300 ${on ? "bg-white/15" : "bg-white text-slate-500 ring-1 ring-slate-200"}`}>
          <i className={`ph-bold ${roleIcon(r)} text-[15px]`} aria-hidden="true"></i>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold">{r.name}</span>
          <span className={`block text-[11px] font-semibold ${on ? "text-white/60" : "text-slate-400"}`}>
            {r.userCount} {r.userCount === 1 ? "person" : "people"}
          </span>
        </span>
        {r.locked && <i className={`ph-bold ph-lock-simple text-xs ${on ? "text-white/50" : "text-slate-300"}`} aria-label="Full access"></i>}
      </button>
    </li>
  );
}


/** Settings → Roles & Permissions: Admin, Manager and Staff plus custom roles (create, duplicate, rename, edit, delete). */
export default function RolesPermissions() {
  const { roles, mutate, isLoading } = useRoles();
  const [selectedKey, setSelectedKey] = useState("STAFF");
  const selected = roles.find((r) => r.key === selectedKey) ?? roles.find((r) => r.key === "STAFF") ?? roles[0];

  // Draft edits for the selected role; reset when another role is picked or the server copy changes.
  const [draft, setDraft] = useState<Draft | null>(null);
  const [draftFor, setDraftFor] = useState<RoleSummary | null>(null);
  if (selected && selected !== draftFor) {
    setDraftFor(selected);
    setDraft(draftOf(selected));
  }
  const dirty = !!selected && !!draft && !sameDraft(draft, draftOf(selected));

  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState<{ from: RoleSummary | null } | null>(null);
  const [deleting, setDeleting] = useState<RoleSummary | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  const toggle = (p: Permission) =>
    setDraft((d) => (d ? { ...d, permissions: d.permissions.includes(p) ? d.permissions.filter((x) => x !== p) : PERMISSIONS.filter((x) => x === p || d.permissions.includes(x)) } : d));

  const save = async () => {
    if (!selected || !draft) return;
    setSaving(true);
    try {
      const body = selected.kind === "custom" ? { name: draft.name, description: draft.description || null, permissions: draft.permissions } : { permissions: draft.permissions };
      const res = await fetch(`/api/roles/${selected.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error((await res.json()).error || "Couldn't save the role");
      await mutate();
      toast.success(`Saved ${draft.name.trim() || selected.name}`, { description: "People with this role get the change within a minute." });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (isLoading && roles.length === 0) {
    return (
      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        <div className="h-72 animate-pulse rounded-3xl bg-slate-100" />
        <div className="h-[28rem] animate-pulse rounded-3xl bg-slate-100" />
      </div>
    );
  }

  const system = roles.filter((r) => r.kind === "system");
  const custom = roles.filter((r) => r.kind === "custom");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-[1.75rem] font-bold tracking-tight text-slate-900">Roles & Permissions</h2>
          <p className="mt-1 text-sm text-slate-500">Admin, Manager and Staff come built in. Create your own roles, rename or delete them, or duplicate one to start from its permissions.</p>
        </div>
        <button
          type="button"
          onClick={() => setCreating({ from: null })}
          className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-slate-800 hover:shadow-md"
        >
          <i className="ph-bold ph-plus" aria-hidden="true"></i>
          New role
        </button>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[260px_1fr]">
        <GlideGroup as="nav" aria-label="Roles" active={selected?.key} pillClassName="rounded-2xl bg-slate-900 shadow-md" className="flex flex-col gap-4 rounded-3xl border border-slate-200/80 bg-white/80 p-2.5 lg:sticky lg:top-4">
          <div>
            <p className="px-3 pt-1 pb-1.5 text-[0.65rem] font-extrabold uppercase tracking-wider text-slate-400">Built in</p>
            <ul className="grid grid-cols-1 gap-0.5 sm:grid-cols-2 lg:flex lg:flex-col">
              {system.map((r) => <RoleItem key={r.key} r={r} on={r.key === selected?.key} onSelect={() => setSelectedKey(r.key)} />)}
            </ul>
          </div>
          <div>
            <p className="px-3 pb-1.5 text-[0.65rem] font-extrabold uppercase tracking-wider text-slate-400">Custom</p>
            {custom.length ? (
              <ul className="grid grid-cols-1 gap-0.5 sm:grid-cols-2 lg:flex lg:flex-col">
                {custom.map((r) => <RoleItem key={r.key} r={r} on={r.key === selected?.key} onSelect={() => setSelectedKey(r.key)} />)}
              </ul>
            ) : (
              <button type="button" onClick={() => setCreating({ from: null })} className="mx-1 mb-1 flex w-[calc(100%-0.5rem)] items-center gap-2 rounded-2xl border border-dashed border-slate-200 px-3 py-3 text-left text-xs font-semibold text-slate-400 transition-colors hover:border-orange-300 hover:text-orange-600">
                <i className="ph-bold ph-plus-circle text-base" aria-hidden="true"></i>
                Create your first custom role
              </button>
            )}
          </div>
        </GlideGroup>

        {selected && draft && (
          <section key={selected.key} className="animate-rise relative flex flex-col gap-5 rounded-3xl border border-slate-200/80 bg-white/80 p-5 backdrop-blur md:p-6">
            <header className="flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-900 to-slate-700 text-white shadow-lg shadow-slate-900/20">
                <i className={`ph-bold ${roleIcon(selected)} text-xl`} aria-hidden="true"></i>
              </span>
              <div className="min-w-0 flex-1">
                {selected.kind === "custom" ? (
                  <>
                    <input
                      ref={nameRef}
                      value={draft.name}
                      onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                      maxLength={40}
                      aria-label="Role name"
                      className="-mx-1.5 w-full rounded-lg bg-transparent px-1.5 text-xl font-black text-slate-900 hover:bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                    />
                    <input
                      value={draft.description}
                      onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                      maxLength={200}
                      placeholder="Add a description"
                      aria-label="Role description"
                      className="-mx-1.5 mt-0.5 w-full rounded-lg bg-transparent px-1.5 text-sm text-slate-500 placeholder:text-slate-300 hover:bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                    />
                  </>
                ) : (
                  <>
                    <h3 className="text-xl font-black text-slate-900">{selected.name}</h3>
                    <p className="text-sm text-slate-500">{selected.description}</p>
                  </>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">
                    {selected.userCount} {selected.userCount === 1 ? "person" : "people"}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">
                    {selected.locked ? "Full access" : `${draft.permissions.length} of ${PERMISSIONS.length} permissions`}
                  </span>
                </div>
              </div>

              {selected.kind === "custom" && (
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      nameRef.current?.focus();
                      nameRef.current?.select();
                    }}
                    className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 transition-colors hover:bg-slate-50"
                  >
                    <i className="ph-bold ph-pencil-simple" aria-hidden="true"></i>
                    Rename
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleting(selected)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-rose-600 ring-1 ring-rose-200 transition-colors hover:bg-rose-50"
                  >
                    <i className="ph-bold ph-trash" aria-hidden="true"></i>
                    Delete
                  </button>
                </div>
              )}

              <Popover open={menuOpen} onOpenChange={setMenuOpen}>
                <PopoverTrigger aria-label="Role actions" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-500 ring-1 ring-slate-200 transition-colors hover:bg-slate-50 hover:text-slate-900">
                  <i className="ph-bold ph-dots-three text-lg" aria-hidden="true"></i>
                </PopoverTrigger>
                <PopoverContent align="end" className="!w-48 !gap-0 !rounded-2xl !p-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      setCreating({ from: selected });
                    }}
                    className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <i className="ph-bold ph-copy" aria-hidden="true"></i>
                    Duplicate
                  </button>
                </PopoverContent>
              </Popover>
            </header>

            {selected.locked && (
              <p className="flex items-center gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800 ring-1 ring-amber-100">
                <i className="ph-bold ph-lock-simple" aria-hidden="true"></i>
                Admins always have full access, including the team, roles and settings, so nobody gets locked out.
              </p>
            )}

            <PermissionList granted={draft.permissions} onToggle={selected.locked ? undefined : toggle} />

            {dirty && (
              <div className="animate-rise sticky bottom-4 flex items-center justify-between gap-3 rounded-2xl bg-slate-900 px-4 py-3 text-white shadow-[0_20px_50px_-15px_rgba(15,23,42,0.6)]">
                <span className="text-sm font-semibold text-white/80">Unsaved changes</span>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setDraft(draftOf(selected))} className="rounded-lg px-3 py-1.5 text-sm font-bold text-white/70 hover:text-white">
                    Discard
                  </button>
                  <button type="button" onClick={save} disabled={saving || !draft.name.trim()} className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-3.5 py-1.5 text-sm font-bold text-white transition-colors hover:bg-orange-600 disabled:opacity-50">
                    {saving && <i className="ph-bold ph-circle-notch animate-spin" aria-hidden="true"></i>}
                    Save
                  </button>
                </div>
              </div>
            )}
          </section>
        )}
      </div>

      {creating && (
        <RoleDialog
          roles={roles}
          from={creating.from}
          onClose={() => setCreating(null)}
          onCreated={async (key) => {
            setCreating(null);
            await mutate();
            setSelectedKey(key);
          }}
        />
      )}
      {deleting && (
        <DeleteRoleDialog
          role={deleting}
          roles={roles}
          onClose={() => setDeleting(null)}
          onDeleted={async () => {
            setDeleting(null);
            setSelectedKey("STAFF");
            await mutate();
          }}
        />
      )}
    </div>
  );
}
