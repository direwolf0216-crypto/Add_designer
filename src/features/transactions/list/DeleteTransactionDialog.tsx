"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { invalidateFinance } from "@/lib/swr";

interface DeleteTransactionDialogProps {
  /** Transaction id, or a `grp_…` group id (deletes the whole group). Null closes the dialog. */
  deleteId: string | null;
  onClose: () => void;
}

/** Confirm-and-delete dialog; refreshes finance caches and toasts the outcome. */
export function DeleteTransactionDialog({ deleteId, onClose }: DeleteTransactionDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const confirmDelete = async () => {
    if (!deleteId) return;
    setIsDeleting(true);
    try {
      const isGroup = deleteId.startsWith('grp_');
      const url = isGroup ? `/api/transactions/bulk/${deleteId}` : `/api/transactions/${deleteId}`;
      const res = await fetch(url, { method: 'DELETE' });
      if (res.ok) {
        invalidateFinance();
        toast.success(isGroup ? "Group deleted." : "Transaction deleted.");
      } else {
        toast.error("Failed to delete. Please try again.");
      }
    } catch {
      toast.error("Network error. Please try again.");
    }
    setIsDeleting(false);
    onClose();
  };

  return (
    <Dialog open={!!deleteId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[400px] w-[calc(100vw-2rem)] sm:w-full p-6 sm:p-8 text-center bg-white rounded-3xl border-0 shadow-2xl !rounded-3xl">
        <div className="w-16 h-16 rounded-full bg-red-50 text-red-500 flex items-center justify-center text-3xl mx-auto mb-5">
          <i className="ph-fill ph-trash"></i>
        </div>
        <DialogTitle className="text-xl font-extrabold text-slate-900 mb-2">Delete Transaction</DialogTitle>
        <p className="text-slate-500 text-[0.95rem] leading-relaxed mb-8">
          Are you sure you want to delete this transaction? This action cannot be undone.
        </p>
        <div className="flex gap-3 justify-center">
          <button 
            className="flex-1 px-5 py-2.5 rounded-full font-bold text-[0.95rem] text-slate-700 bg-white border border-gray-200 hover:bg-slate-50 transition-colors" 
            onClick={onClose}
            disabled={isDeleting}
          >
            Cancel
          </button>
          <button 
            className="flex-1 px-5 py-2.5 rounded-full font-bold text-[0.95rem] text-white bg-red-500 hover:bg-red-600 shadow-md transition-all flex items-center justify-center gap-2" 
            onClick={confirmDelete}
            disabled={isDeleting}
          >
            {isDeleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
