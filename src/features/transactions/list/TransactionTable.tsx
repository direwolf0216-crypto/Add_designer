"use client";

import { useMemo, useState } from "react";
import { groupTransactions } from "@/lib/transactions/grouping";
import type { TransactionRecord } from "@/lib/transactions/types";
import { TransactionGroupRow } from "./TransactionGroupRow";
import { TransactionListSkeleton } from "./TransactionListSkeleton";
import { TransactionRow } from "./TransactionRow";

interface TransactionTableProps {
  transactions: TransactionRecord[];
  isLoading: boolean;
  /** Filters are narrowing the result (changes the empty-state copy and offers "Clear Filters"). */
  hasFilters: boolean;
  onClearFilters: () => void;
  onOpenDetails: (id: string) => void;
  onEdit: (id: string) => void;
  /** Ask to delete a transaction or a group (by its group id). */
  onDelete: (id: string) => void;
  canEdit?: boolean;
  canDelete?: boolean;
}

/** Loading skeleton, empty state, or the grouped transaction rows with expandable bulk groups. */
export function TransactionTable({ transactions, isLoading, hasFilters, onClearFilters, onOpenDetails, onEdit, onDelete, canEdit, canDelete }: TransactionTableProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const items = useMemo(() => groupTransactions(transactions), [transactions]);

  const toggleGroup = (groupId: string) => {
    const newSet = new Set(expandedGroups);
    if (newSet.has(groupId)) newSet.delete(groupId);
    else newSet.add(groupId);
    setExpandedGroups(newSet);
  };

  return (
    <div className="flex flex-col gap-4">
      {isLoading ? (
        <TransactionListSkeleton />
      ) : transactions.length === 0 ? (
        // U3: Better empty state with CTA
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <div className="w-16 h-16 rounded-2xl bg-orange-50 flex items-center justify-center mb-4">
            <i className="ph-bold ph-receipt text-3xl text-orange-400"></i>
          </div>
          <p className="font-bold text-slate-700 text-base mb-1">No transactions found</p>
          <p className="font-medium text-sm text-center max-w-xs">
            {hasFilters
              ? 'No records match your active filters. Try clearing them to see all transactions.'
              : 'Start building your ledger by clicking "Add Transaction" in the top bar.'}
          </p>
          {hasFilters && (
            <button onClick={onClearFilters} className="mt-4 px-4 py-2 rounded-xl bg-orange-50 text-orange-600 font-bold text-sm hover:bg-orange-100 transition-colors">
              Clear Filters
            </button>
          )}
        </div>
      ) : (
        items.map(tx => tx.isGroup ? (
          <TransactionGroupRow
            key={tx.id}
            group={tx}
            isExpanded={expandedGroups.has(tx.id)}
            onToggle={() => toggleGroup(tx.id)}
            onOpenDetails={onOpenDetails}
            onEdit={onEdit}
            onDelete={onDelete}
            canEdit={canEdit}
            canDelete={canDelete}
          />
        ) : (
          <TransactionRow
            key={tx.id}
            tx={tx}
            onOpenDetails={() => onOpenDetails(tx.id)}
            onEdit={() => onEdit(tx.id)}
            onDelete={() => onDelete(tx.id)}
            canEdit={canEdit}
            canDelete={canDelete}
          />
        ))
      )}
    </div>
  );
}
