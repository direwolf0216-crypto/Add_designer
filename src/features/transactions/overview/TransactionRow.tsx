import React from "react";
import { CATEGORY_ICONS, MODE_ICONS } from "@/lib/transactions/categoryTheme";
import type { LedgerItem } from "@/lib/transactions/grouping";
import { formatINR } from "@/lib/money";

interface TransactionRowProps {
  txn: LedgerItem;
  /** Position in the list (staggers the entry animation). */
  idx: number;
  isConfirming: boolean;
  isDeleting: boolean;
  /** Inline delete error for this row, if any. */
  errorMessage: string | null;
  onOpen: () => void;
  onEdit: () => void;
  onAskDelete: () => void;
  canEdit?: boolean;
  canDelete?: boolean;
  onCancelDelete: () => void;
  onDismissError: () => void;
  onConfirmDelete: (e: React.MouseEvent) => void;
}

/** One row of the overview's "Today's Transactions" ledger (a single line or a collapsed group). */
export function TransactionRow({
  txn, idx, isConfirming, isDeleting, errorMessage,
  onOpen, onEdit, onAskDelete, onCancelDelete, onDismissError, onConfirmDelete, canEdit = true, canDelete = true,
}: TransactionRowProps) {
  return (
    <div
      onClick={onOpen}
      className="group/item flex flex-col sm:flex-row sm:items-center justify-between bg-white/[0.03] hover:bg-white/[0.08] backdrop-blur-sm rounded-2xl px-4 sm:px-5 py-3 sm:py-3.5 border border-white/[0.06] hover:border-white/15 transition-all duration-200 cursor-pointer gap-2 sm:gap-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
      style={{ animationDelay: `${idx * 60}ms` }}
    >
      <div className="flex items-center gap-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shadow-lg ${txn.type === 'INCOME'
            ? 'bg-gradient-to-br from-emerald-400/20 to-emerald-600/20 text-emerald-400 shadow-emerald-500/10'
            : 'bg-gradient-to-br from-red-400/20 to-red-600/20 text-red-400 shadow-red-500/10'
          }`}>
          <i className={`ph-fill ${CATEGORY_ICONS[txn.category] || 'ph-dots-three-circle'}`} />
        </div>
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            {(() => {
              const title = txn.category;

              return (
                <>
                  <span className="text-white font-bold text-[0.9rem] leading-tight">{title}</span>
                  <span className={`px-2 py-0.5 rounded-md text-[0.55rem] font-extrabold uppercase tracking-[0.5px] ${txn.type === 'INCOME'
                      ? 'bg-emerald-500/15 text-emerald-400'
                      : 'bg-red-500/15 text-red-400'
                    }`}>{txn.type}</span>

                </>
              );
            })()}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            {txn.description && (
              <span className="text-slate-500 text-[0.75rem] font-medium truncate max-w-[200px]">{txn.description}</span>
            )}
            <span className="text-slate-600 text-[0.65rem] flex items-center gap-1">
              <i className={`ph-fill ${MODE_ICONS[txn.paymentMode ?? ''] || 'ph-wallet'} text-[0.6rem]`} />
              {txn.paymentMode}
            </span>
            </div>
          </div>
        </div>
      <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto mt-2 sm:mt-0 border-t border-white/10 sm:border-0 pt-2 sm:pt-0">
        <span className="text-slate-500 text-[0.7rem] font-semibold">
          {new Date(txn.date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
        </span>
        <span className={`min-w-[100px] text-right text-sm sm:text-base font-black ${
            txn.type === 'INCOME' ? 'text-emerald-400' : 'text-red-400'
          }`}>
          {txn.type === 'INCOME' ? '+' : '\u2212'}{formatINR(txn.amount)}
        </span>
        <div className="flex flex-col items-end gap-1 ml-2">
           {!txn.isGroup && <span className="text-[0.6rem] font-mono text-slate-500 bg-white/[0.05] px-1.5 py-0.5 rounded tracking-wider">{txn.transactionId}</span>}
           {txn.isGroup && <span className="text-[0.6rem] font-bold text-orange-400 bg-orange-500/10 px-1.5 py-0.5 rounded tracking-wider">{txn.children.length} ITEMS</span>}
        </div>
        <div className={`flex items-center gap-1 ${isConfirming || errorMessage !== null ? 'opacity-100' : 'opacity-0 group-hover/item:opacity-100'} transition-opacity ml-2`}>
          {isDeleting ? (
            <div className="flex items-center gap-2 text-slate-400 px-2">
              <i className="ph ph-circle-notch animate-spin text-lg" />
              <span className="text-xs font-bold">Deleting...</span>
            </div>
          ) : isConfirming ? (
            <div className="flex items-center gap-2 bg-red-500/10 rounded-lg px-2 py-1">
              <span className="text-[0.65rem] font-bold text-red-400 uppercase tracking-widest">Delete?</span>
              <button
                onClick={onConfirmDelete}
                className="p-1 rounded bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white transition-colors"
              >
                <i className="ph-bold ph-check" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onCancelDelete(); }}
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <i className="ph-bold ph-x" />
              </button>
            </div>
          ) : errorMessage !== null ? (
            <div className="flex items-center gap-2 bg-rose-500/10 rounded-lg px-2 py-1">
              <span className="text-xs font-bold text-rose-400">{errorMessage}</span>
              <button
                onClick={(e) => { e.stopPropagation(); onDismissError(); }}
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <i className="ph-bold ph-x" />
              </button>
            </div>
          ) : (
            <>
              <div className={`flex items-center gap-1 w-[64px] justify-end ${txn.productOrderId || txn.jobId ? 'invisible' : 'visible'}`}>
                {canEdit && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit();
                  }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                  title="Edit transaction"
                >
                  <i className="ph ph-pencil-simple text-lg" />
                </button>
                )}
                {canDelete && (
                <button
                  onClick={(e) => { e.stopPropagation(); onAskDelete(); }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                  title="Delete transaction"
                >
                  <i className="ph ph-trash text-lg" />
                </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
