"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { RemoveFieldPrompt } from "./useLayoutBuilder";

interface RemoveFieldDialogProps {
  /** The pending prompt; null closes the dialog (it stays mounted so the close animation and focus restore run). */
  prompt: RemoveFieldPrompt | null;
  formNoun: string;
  onArchive: () => void;
  onDelete: () => void;
  onCancel: () => void;
}

/** Delete protection: the field has saved values, so archiving is offered before deleting. */
export default function RemoveFieldDialog({ prompt: current, formNoun, onArchive, onDelete, onCancel }: RemoveFieldDialogProps) {
  // Keep showing the last prompt while the dialog animates closed (state adjusted during render).
  const [last, setLast] = useState<RemoveFieldPrompt | null>(current);
  if (current && current !== last) setLast(current);
  const prompt = current ?? last;
  if (!prompt) return null;
  const records = `${prompt.count.toLocaleString("en-IN")} ${formNoun}${prompt.count === 1 ? "" : "s"}`;
  return (
    <Dialog open={!!current} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-[460px] rounded-2xl p-0 overflow-hidden border-0">
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0">
              <i className="ph-fill ph-warning text-xl"></i>
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-lg font-extrabold text-slate-900">“{prompt.fieldName}” holds data</DialogTitle>
              <DialogDescription className="mt-1 text-sm text-slate-600 leading-relaxed">
                {records} already have a value for this field. Deleting it removes the field from the form and hides those values everywhere.
              </DialogDescription>
            </div>
          </div>
        </div>
        <div className="px-6 pb-6 space-y-2">
          <button
            type="button"
            onClick={onArchive}
            className="w-full flex items-center gap-3 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-left hover:bg-violet-100/70 transition-colors"
          >
            <i className="ph-bold ph-archive text-violet-600 text-xl"></i>
            <span>
              <span className="block text-sm font-extrabold text-violet-900">Archive instead <span className="ml-1 rounded-md bg-white/80 px-1.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider text-violet-600">Recommended</span></span>
              <span className="block text-[0.75rem] text-violet-700">Removed from the form for new entries; existing values stay readable in details, exports and reports.</span>
            </span>
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="w-full flex items-center gap-3 rounded-xl border border-red-200 bg-white px-4 py-3 text-left hover:bg-red-50 transition-colors"
          >
            <i className="ph-bold ph-trash text-red-500 text-xl"></i>
            <span>
              <span className="block text-sm font-extrabold text-red-700">Delete anyway</span>
              <span className="block text-[0.75rem] text-slate-500">The values stay in the database but no screen will show them.</span>
            </span>
          </button>
          <button type="button" onClick={onCancel} className="w-full rounded-xl py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-100 transition-colors">
            Keep the field
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
