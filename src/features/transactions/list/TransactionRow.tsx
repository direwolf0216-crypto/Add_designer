import type { ReactNode } from "react";
import { getConsistentColorClasses, getRelatableIcon } from "@/lib/transactions/categoryTheme";
import type { TransactionListItem } from "@/lib/transactions/grouping";
import { formatINR } from "@/lib/money";

interface TransactionRowProps {
  tx: TransactionListItem;
  /** Rendered indented inside an expanded group. */
  isChild?: boolean;
  /** Groups only: whether the children are showing (rotates the caret). */
  isExpanded?: boolean;
  /** Groups only: expand / collapse. */
  onToggle?: () => void;
  onOpenDetails: () => void;
  onEdit: () => void;
  onDelete: () => void;
  /** Rendered after the row inside its wrapper (a group's expanded children). */
  children?: ReactNode;
}

/** One ledger line in the All Transactions list: a single transaction, a group header, or a group child. */
export function TransactionRow({ tx, isChild = false, isExpanded = false, onToggle, onOpenDetails, onEdit, onDelete, children }: TransactionRowProps) {
  const category = tx.isGroup ? tx.categoryNames[0] : tx.category;
  const colorClass = getConsistentColorClasses(category);
  const iconClass = getRelatableIcon(category);

  return (
    <div className={`${isChild ? 'pl-8 border-l-2 border-slate-100 ml-6 relative before:content-[""] before:absolute before:left-[-2px] before:top-0 before:w-0.5 before:h-full before:bg-slate-100' : ''}`}>
      <div
        onClick={() => !tx.isGroup ? onOpenDetails() : onToggle?.()}
        className={`flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-transparent p-3 transition-all hover:border-slate-200 hover:bg-slate-50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 sm:p-4 group ${isChild ? 'bg-slate-50/50 my-1 py-2 sm:py-2.5 rounded-xl' : ''}`}
      >
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform ${colorClass.bg} ${colorClass.text} ${isChild ? 'w-10 h-10 rounded-lg' : ''}`}>
            <i className={`ph-bold ${iconClass} ${isChild ? 'text-lg' : 'text-xl'}`}></i>
          </div>
          <div className="min-w-0">
            {(() => {
              const title = tx.description ? tx.description.split(' - ')[0] : tx.category;

              return (
                <>
                  <div className="truncate font-bold text-slate-900 text-sm mb-1">
                    {title}
                  </div>
                  <div className="flex min-w-0 items-center gap-2 flex-wrap">
                    <span className={`max-w-[110px] truncate text-[9px] font-extrabold px-2 py-0.5 rounded tracking-wider uppercase ${colorClass.bg} ${colorClass.text}`}>
                      {tx.isGroup ? tx.categoryNames[0] : tx.category}
                    </span>
                    {tx.isGroup && tx.categoryNames.length > 1 && (
                      <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded tracking-wider uppercase bg-slate-100 text-slate-500 shrink-0`}>
                        +{tx.categoryNames.length - 1} more
                      </span>
                    )}

                    <span className="truncate text-[11px] text-slate-400 font-medium shrink-0">{new Date(tx.date).toLocaleDateString('en-GB')} &middot; {tx.paymentMode}</span>
                    {!tx.isGroup && <span className="hidden sm:inline text-[10px] text-slate-300 font-mono shrink-0">{tx.transactionId}</span>}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1 text-right sm:gap-2">
          <div className="min-w-[100px] text-right">
            <div className={`text-sm font-bold sm:text-base ${tx.type === 'INCOME' ? 'text-emerald-600' : 'text-rose-600'}`}>
              {tx.type === 'EXPENSE' ? '\u2212' : ''}{formatINR(tx.amount)}
            </div>
          </div>

          {!tx.isGroup && (
            <div className="flex items-center gap-1 w-[64px] justify-end">
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  onDelete();
                }}
                className={`h-8 w-8 items-center justify-center rounded-full text-slate-300 transition-colors hover:bg-rose-100 hover:text-rose-600 hidden sm:flex sm:opacity-0 sm:group-hover:opacity-100 ${tx.productOrderId || tx.jobId ? 'invisible' : 'visible'}`}
                title="Delete Transaction"
              >
                <i className="ph-bold ph-trash"></i>
              </button>
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  onEdit();
                }}
                className={`h-8 w-8 items-center justify-center rounded-full text-slate-300 transition-colors hover:bg-orange-100 hover:text-orange-600 hidden sm:flex sm:opacity-0 sm:group-hover:opacity-100 ${tx.productOrderId || tx.jobId ? 'invisible' : 'visible'}`}
                title="Edit Transaction"
              >
                <i className="ph-bold ph-pencil-simple"></i>
              </button>
            </div>
          )}
          {tx.isGroup && (
            <div className="flex items-center gap-1 w-[64px] justify-end">
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  onDelete();
                }}
                className={`h-8 w-8 items-center justify-center rounded-full text-slate-300 transition-colors hover:bg-rose-100 hover:text-rose-600 hidden sm:flex sm:opacity-0 sm:group-hover:opacity-100`}
                title="Delete Group"
              >
                <i className="ph-bold ph-trash"></i>
              </button>
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  onEdit();
                }}
                className={`h-8 w-8 items-center justify-center rounded-full text-slate-300 transition-colors hover:bg-orange-100 hover:text-orange-600 hidden sm:flex sm:opacity-0 sm:group-hover:opacity-100`}
                title="Edit Group"
              >
                <i className="ph-bold ph-pencil-simple"></i>
              </button>
            </div>
          )}

          {tx.isGroup ? (
            <button
              type="button"
              onClick={(event) => { event.stopPropagation(); onToggle?.(); }}
              className="ml-1 flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-transform"
            >
              <i className={`ph-bold ph-caret-down transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
            </button>
          ) : !isChild ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onOpenDetails();
              }}
              className="ml-1 flex h-8 w-8 items-center justify-center rounded-full text-slate-300 hover:bg-indigo-50 hover:text-indigo-600"
            >
              <i className="ph-bold ph-caret-right" />
            </button>
          ) : null}
        </div>
      </div>
      {children}
    </div>
  );
}
