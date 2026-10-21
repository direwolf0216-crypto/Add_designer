"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  applyDraftToQuery,
  clearedQuery,
  dayQuery,
  monthQuery,
  readTransactionFilters,
  viewQuery,
  weekQuery,
  type TransactionFilterDraft,
} from "@/lib/transactions/filters";

/**
 * The list's filters live in the URL. This reads them as typed values and exposes setters that push
 * the next query string (so back/forward and shared links keep working).
 */
export function useTransactionFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filters = readTransactionFilters(searchParams);
  // Changes whenever any filter changes; used to reset pagination.
  const filterKey = searchParams.toString();
  const push = (query: string) => router.push(`?${query}`);

  return {
    filters,
    filterKey,
    applyDraft: (draft: TransactionFilterDraft) => push(applyDraftToQuery(filterKey, draft)),
    /** Clear everything except the preset view. */
    clearAll: () => push(clearedQuery(filters.view)),
    setView: (view: string) => push(viewQuery(filterKey, view)),
    setDay: (day: string) => push(dayQuery(filterKey, day)),
    setWeekFromDate: (dateStr: string) => push(weekQuery(filterKey, dateStr)),
    setMonthFromDate: (dateStr: string) => push(monthQuery(filterKey, dateStr)),
  };
}
