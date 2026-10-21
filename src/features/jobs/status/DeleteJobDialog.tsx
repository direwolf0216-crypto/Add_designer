"use client";

interface DeleteJobDialogProps {
  isDeleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** "Move to Bin?" confirmation for a job on the status board. */
export default function DeleteJobDialog({ isDeleting, onConfirm, onCancel }: DeleteJobDialogProps) {
  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-[340px] overflow-hidden animate-in zoom-in-95 duration-300 border border-slate-100">
        <div className="p-8 pb-6 flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-100 to-red-50 border border-red-100/50 flex items-center justify-center mb-5 shadow-inner">
            <i className="ph-fill ph-trash text-red-600 text-3xl"></i>
          </div>
          <h3 className="text-xl font-extrabold text-slate-800 mb-2.5 tracking-tight">Move to Bin?</h3>
          <p className="text-[0.9rem] text-slate-500 leading-relaxed">
            This job will be moved to the bin. You can always restore it later if needed.
          </p>
        </div>
        <div className="px-8 pb-8 flex flex-col gap-3 mt-2">
          <button
            type="button"
            disabled={isDeleting}
            onClick={onConfirm}
            className="w-full py-3.5 text-[0.95rem] font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-all shadow-lg shadow-red-600/25 disabled:opacity-70 flex items-center justify-center gap-2"
          >
            {isDeleting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                Moving...
              </>
            ) : 'Move to Bin'}
          </button>
          <button
            type="button"
            disabled={isDeleting}
            onClick={onCancel}
            className="w-full py-3.5 text-[0.95rem] font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-50 bg-white border-2 border-slate-100 rounded-xl transition-all disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
