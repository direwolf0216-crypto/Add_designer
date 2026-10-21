"use client";

import { Trash2 } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";

export default function DeleteJobDialog({
  open,
  onOpenChange,
  onConfirm,
  isDeleting,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isDeleting: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-[95vw] rounded-3xl p-6 bg-white border-0 shadow-2xl">
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-6">
            <Trash2 className="w-8 h-8 text-red-600" />
          </div>
          <h3 className="text-2xl font-black text-slate-900 mb-2">Delete Job?</h3>
          <p className="text-slate-500 mb-8 font-medium">This action cannot be undone. This will permanently remove the job and all related data.</p>
          <div className="flex items-center gap-3 w-full">
            <button
              onClick={() => onOpenChange(false)}
              className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={isDeleting}
              className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
            >
              {isDeleting ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : "Yes, Delete"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
