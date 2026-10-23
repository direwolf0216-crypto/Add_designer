"use client";

import { useMemo } from "react";
import useSWR, { mutate } from "swr";
import type { TransactionRecord } from "@/lib/transactions/types";
import type { WeekSummary } from "@/lib/transactions/weekly";
import type { ModeSplit } from "@/lib/transactions/paymentModes";
import { ledgerOverviewKey } from "@/lib/warmPageData";

// Intentionally not the shared `fetcher`: this page has always rendered whatever JSON comes back
// (falling back to zero totals) rather than surfacing a fetch error.
const jsonFetcher = (url: string) => fetch(url).then(res => res.json());

export interface TransactionsOverviewData {
  todayTransactions?: TransactionRecord[];
  todayIncome?: number;
  todayExpense?: number;
  todayNet?: number;
  /** Today's income / expense / net by Cash, UPI, Bank and Other, over every transaction today. */
  todayByMode?: ModeSplit;
  /** Server-computed current week (IST, Mon..Sun) with last week's totals. */
  week?: WeekSummary;
}

/** Today's ledger data and a delete that updates the cache. */
export function useTransactionsOverview(initialData?: TransactionsOverviewData, weekOf?: string | null) {
  // The same key the sidebar warms on hover (useWarmPageData), so a warmed ledger opens instantly.
  // A chosen week (yyyy-MM-dd inside it) changes only the weekly cards; today's figures stay.
  const overviewKey = useMemo(() => `${ledgerOverviewKey()}${weekOf ? `&week=${weekOf}` : ""}`, [weekOf]);

  // The ledger page sends today's figures with the page, so they show at once.
  const { data, error, isLoading } = useSWR<TransactionsOverviewData>(overviewKey, jsonFetcher, {
    fallbackData: weekOf ? undefined : initialData,
    revalidateOnMount: weekOf ? true : !initialData,
    keepPreviousData: true,
  });

  /** Delete a transaction (or a whole `grp_…` group) and drop it from the cached overview. Throws on failure. */
  const deleteTransaction = async (id: string) => {
    const isGroup = id.startsWith('grp_');
    const url = isGroup ? `/api/transactions/bulk/${id}` : `/api/transactions/${id}`;
    const res = await fetch(url, { method: 'DELETE' });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || "Failed to delete");
    }

    // Optimistic update
    const keep = (tx: TransactionRecord) => (isGroup ? tx.groupId !== id : tx.id !== id);
    mutate(overviewKey, (currentData: TransactionsOverviewData | undefined) => {
      if (!currentData) return currentData;
      return {
        ...currentData,
        todayTransactions: currentData.todayTransactions!.filter(keep),
      };
    }, { revalidate: true });
  };

  return { data, error, isLoading, deleteTransaction };
}
