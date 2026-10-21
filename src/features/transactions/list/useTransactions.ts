"use client";

import { useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/swr";
import { buildListQuery, PAGE_SIZE, type TransactionUrlFilters } from "@/lib/transactions/filters";
import type { TransactionRecord } from "@/lib/transactions/types";

/** Paged transaction list for the given URL filters. The page resets to 1 whenever `filterKey` changes. */
export function useTransactions(filters: TransactionUrlFilters, filterKey: string) {
  // Page resets whenever the filters (URL) change, without an effect.
  const [pageState, setPageState] = useState({ filterKey, page: 1 });
  const currentPage = pageState.filterKey === filterKey ? pageState.page : 1;

  // SWR (not local state) so saves from the global transaction modal refresh this list too.
  const { data: listData, isLoading, isValidating } = useSWR<{ items?: TransactionRecord[]; total?: number }>(
    `/api/transactions?${buildListQuery(filters, currentPage)}`,
    fetcher,
    { keepPreviousData: true }
  );
  const transactions = listData?.items ?? [];
  const totalCount = listData?.total ?? 0;

  return {
    transactions,
    totalCount,
    totalPages: Math.ceil(totalCount / PAGE_SIZE),
    currentPage,
    isLoading,
    isLoadingMore: isValidating && !isLoading,
    goToPage: (page: number) => setPageState({ filterKey, page }),
  };
}
