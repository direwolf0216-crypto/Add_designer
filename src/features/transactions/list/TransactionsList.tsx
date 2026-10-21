"use client";

import { useState } from "react";
import { useGlobalForm } from "@/components/providers/GlobalFormProvider";
import BudgetOverview from "@/components/dashboard/BudgetOverview";
import HighPriorityAlerts from "@/components/dashboard/HighPriorityAlerts";
import {
  EMPTY_FILTER_DRAFT,
  PAGE_SIZE,
  draftFromFilters,
  hasAdvancedFilters,
  hasEmptyStateFilters,
} from "@/lib/transactions/filters";
import { useTransactionFilters } from "./useTransactionFilters";
import { useTransactions } from "./useTransactions";
import { ExportMenu } from "./ExportMenu";
import { PeriodPicker } from "./PeriodPicker";
import { ActiveFilterBadges } from "./ActiveFilterBadges";
import { TransactionTable } from "./TransactionTable";
import { Pagination } from "./Pagination";
import { DeleteTransactionDialog } from "./DeleteTransactionDialog";
import { TransactionFiltersDialog } from "./TransactionFiltersDialog";

/** All Transactions: URL-driven filters, paged + grouped ledger, export and delete. Needs a Suspense boundary. */
export function TransactionsList() {
  const { openTransactionDetails, openTransactionForm } = useGlobalForm();
  const { filters, filterKey, applyDraft, clearAll, setView, setDay, setWeekFromDate, setMonthFromDate } = useTransactionFilters();
  const { transactions, totalCount, totalPages, currentPage, isLoading, isLoadingMore, goToPage } = useTransactions(filters, filterKey);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [tempFilters, setTempFilters] = useState(EMPTY_FILTER_DRAFT);

  // Bug fix: Always sync tempFilters from URL when filter modal opens so stale values are never shown
  const openFilterModal = () => {
    setTempFilters(draftFromFilters(filters));
    setIsFilterModalOpen(true);
  };

  const applyFilters = () => {
    applyDraft(tempFilters);
    setIsFilterModalOpen(false);
  };

  // Bug fix: Clear All must also clear the URL params so the data refreshes immediately
  const clearAllFilters = () => {
    setTempFilters(EMPTY_FILTER_DRAFT);
    clearAll();
    setIsFilterModalOpen(false);
  };

  return (
    <div className="animate-fade-in w-full">
      <HighPriorityAlerts />
      <BudgetOverview />

      {/* Transaction Activity */}
      <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-slate-100 animate-slide-up" style={{ animationDelay: "100ms" }}>

        <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-8">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Transaction History</h2>
            {/* U6 FIX: Hide record count while loading */}
            {!isLoading && (
              <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">{totalCount} Records</div>
            )}
          </div>

          {/* Preset Views & Pickers */}
          <div className="flex flex-wrap items-center gap-3 relative z-[50]">
            <button onClick={openFilterModal} className={`h-[45px] px-4 rounded-xl border bg-white shadow-sm font-bold text-[0.95rem] flex items-center gap-2 transition-all hover:shadow-md hover:border-slate-300 active:scale-95 ${hasAdvancedFilters(filters) ? 'border-orange-400 text-orange-600' : 'border-slate-200 text-slate-700'}`}>
              <i className="ph-bold ph-faders"></i> Filters
            </button>
            {transactions.length > 0 && <ExportMenu transactions={transactions} />}
            <PeriodPicker
              filters={filters}
              onViewChange={setView}
              onDayChange={setDay}
              onWeekChange={setWeekFromDate}
              onMonthChange={setMonthFromDate}
            />
          </div>
        </div>

        {/* Active Filter Badges */}
        <ActiveFilterBadges filters={filters} onClear={clearAllFilters} />

        <TransactionTable
          transactions={transactions}
          isLoading={isLoading}
          hasFilters={hasEmptyStateFilters(filters)}
          onClearFilters={clearAllFilters}
          onOpenDetails={openTransactionDetails}
          onEdit={(id) => openTransactionForm(id)}
          onDelete={setDeleteId}
        />

        {/* F5/P2: Pagination Controls */}
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalCount={totalCount}
          pageSize={PAGE_SIZE}
          isLoadingMore={isLoadingMore}
          onPageChange={goToPage}
        />
      </div>

      {/* Delete Confirmation Modal */}
      <DeleteTransactionDialog deleteId={deleteId} onClose={() => setDeleteId(null)} />

      {/* Advanced Filter Modal */}
      <TransactionFiltersDialog
        open={isFilterModalOpen}
        onOpenChange={setIsFilterModalOpen}
        value={tempFilters}
        onChange={setTempFilters}
        onApply={applyFilters}
        onClearAll={clearAllFilters}
      />
    </div>
  );
}
