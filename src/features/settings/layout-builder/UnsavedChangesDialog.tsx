"use client";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

interface UnsavedChangesDialogProps {
  open: boolean;
  saving: boolean;
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
}

/** Shown when leaving the editor with unsaved edits. */
export default function UnsavedChangesDialog({ open, saving, onSave, onDiscard, onCancel }: UnsavedChangesDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-[440px] rounded-2xl p-6 border-0">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0">
            <i className="ph-fill ph-floppy-disk text-xl"></i>
          </div>
          <div>
            <DialogTitle className="text-lg font-extrabold text-slate-900">Save your layout changes?</DialogTitle>
            <DialogDescription className="mt-1 text-sm text-slate-600 leading-relaxed">
              You have edits that are not saved yet. Leaving now throws them away.
            </DialogDescription>
          </div>
        </div>
        <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button type="button" onClick={onDiscard} className="px-4 py-2.5 rounded-xl text-sm font-bold text-red-600 hover:bg-red-50 transition-colors">
            Discard changes
          </button>
          <button type="button" onClick={onCancel} className="px-4 py-2.5 rounded-xl text-sm font-bold text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors">
            Keep editing
          </button>
          <button type="button" onClick={onSave} disabled={saving} className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-slate-900 hover:bg-slate-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <i className="ph-bold ph-check"></i>}
            Save and leave
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
