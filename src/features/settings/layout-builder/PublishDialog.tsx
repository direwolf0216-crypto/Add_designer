"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { LayoutChange } from "@/lib/layout-builder/diff";

interface PublishDialogProps {
  open: boolean;
  formName: string;
  nextVersion: number;
  changes: LayoutChange[];
  publishing: boolean;
  onConfirm: (note: string) => void;
  onCancel: () => void;
}

/** What publishing changes for everyone, with an optional note for the history. */
export default function PublishDialog({ open, formName, nextVersion, changes, publishing, onConfirm, onCancel }: PublishDialogProps) {
  const [note, setNote] = useState("");
  // Each publish starts with a fresh note (state adjusted during render when the dialog closes).
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (!open) setNote("");
  }
  const risky = changes.filter((c) => c.affectsData);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-[520px] rounded-2xl p-0 overflow-hidden border-0">
        <div className="px-6 pt-6 pb-4 border-b border-gray-100">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0">
              <i className="ph-bold ph-rocket-launch text-xl"></i>
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-lg font-extrabold text-slate-900">Publish {formName} as version {nextVersion}</DialogTitle>
              <DialogDescription className="mt-1 text-sm text-slate-600 leading-relaxed">
                Everyone sees these changes the next time they open the form. The previous version stays in History.
              </DialogDescription>
            </div>
          </div>
        </div>
        <div className="px-6 py-4 max-h-[40dvh] overflow-y-auto">
          {changes.length === 0 ? (
            <p className="text-sm text-slate-500">No differences from the live layout.</p>
          ) : (
            <ul className="space-y-1.5">
              {changes.map((c, i) => (
                <li key={i} className={`flex items-start gap-2 text-[0.85rem] ${c.affectsData ? "text-amber-800" : "text-slate-700"}`}>
                  <i className={`ph-bold mt-0.5 ${c.affectsData ? "ph-warning text-amber-500" : "ph-dot-outline text-slate-300"}`}></i>
                  <span>{c.text}</span>
                </li>
              ))}
            </ul>
          )}
          {risky.length > 0 && (
            <p className="mt-3 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-[0.75rem] text-amber-800 leading-snug">
              Values saved under removed fields stop showing anywhere. Archive a field instead if you want to keep them readable.
            </p>
          )}
          <label className="block mt-4 text-[0.75rem] font-bold text-slate-600 mb-1.5">Note for the history <span className="font-normal text-slate-400">(optional)</span></label>
          <input
            type="text"
            value={note}
            maxLength={300}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Added GST number, made due date required"
            className="w-full text-sm font-semibold text-slate-800 border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 transition-all placeholder:font-normal placeholder:text-slate-400"
          />
        </div>
        <div className="px-6 pb-6 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="px-4 py-2.5 rounded-xl text-sm font-bold text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors">Not yet</button>
          <button type="button" onClick={() => onConfirm(note)} disabled={publishing} className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-slate-900 hover:bg-slate-800 transition-colors disabled:opacity-50 flex items-center gap-2">
            {publishing ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <i className="ph-bold ph-rocket-launch"></i>}
            Publish version {nextVersion}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
