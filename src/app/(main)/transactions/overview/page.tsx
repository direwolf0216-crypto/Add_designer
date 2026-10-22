"use client";

import { useGlobalForm } from "@/components/providers/GlobalFormProvider";
import {
  buildHeatmapSegments,
  buildQuickAddCategories,
  buildTodaySegments,
  layoutCategoryOptions,
  netForPaymentMode,
  sumByCategory,
  toCategoryShares,
} from "@/lib/transactions/analytics";
import { useTransactionsOverview } from "@/features/transactions/overview/useTransactionsOverview";
import { TodayKpiCards } from "@/features/transactions/overview/TodayKpiCards";
import { DonutBreakdownCard } from "@/features/transactions/overview/DonutBreakdownCard";
import { QuickAddBar } from "@/features/transactions/overview/QuickAddBar";
import { TodayLedger } from "@/features/transactions/overview/TodayLedger";
import { ExpenseHeatmapCard } from "@/features/transactions/overview/ExpenseHeatmapCard";
import { IncomeFlowChart } from "@/features/transactions/overview/IncomeFlowChart";
import { NetTrendChart } from "@/features/transactions/overview/NetTrendChart";
import { SmartInsightBanner } from "@/features/transactions/overview/SmartInsightBanner";
import PageReveal from "@/components/motion/PageReveal";
import { usePermissions } from "@/hooks/usePermissions";
import { format, parseISO } from "date-fns";
import type { WeekSummary } from "@/lib/transactions/weekly";

const EMPTY_WEEK: WeekSummary = { days: [], totals: { income: 0, expense: 0, net: 0 }, previous: { income: 0, expense: 0, net: 0 }, expensesByCategory: [] };

function OverviewPageContent() {
  const { openTransactionForm, openTransactionDetails } = useGlobalForm();
  const { data, isLoading, layoutSchema, deleteTransaction } = useTransactionsOverview();
  const { checkPermission } = usePermissions();
  const canCreate = checkPermission("create_transactions");
  const canEdit = checkPermission("edit_transactions");
  const canDelete = checkPermission("delete_transactions");

  if (isLoading || !data) {
    return <div className="flex justify-center items-center h-64"><div className="animate-pulse w-8 h-8 rounded-full bg-orange-500"></div></div>;
  }

  const {
    todayTransactions = [],
    todayIncome = 0,
    todayExpense = 0,
    todayNet = 0,
    week = EMPTY_WEEK,
  } = data;

  const today = new Date();

  // This week's figures all come from the server-side weekly summary, so cards and charts agree.
  const weekCategories = Object.fromEntries(week.expensesByCategory.map((c) => [c.category, c.amount]));
  const donutSegments = buildHeatmapSegments(weekCategories, week.totals.expense);
  const highestExpenseCategory = donutSegments.length > 0 ? donutSegments[0] : null;
  const elapsed = week.days.filter((d) => !d.isFuture);
  const rangeLabel = week.days.length
    ? `${format(parseISO(week.days[0].date), "d MMM")} – ${format(parseISO(week.days[6].date), "d MMM")}`
    : "";

  // Today's breakdowns.
  const todayIncomeSegments = buildTodaySegments(toCategoryShares(sumByCategory(todayTransactions, 'INCOME'), todayIncome));
  const todayExpenseSegments = buildTodaySegments(toCategoryShares(sumByCategory(todayTransactions, 'EXPENSE'), todayExpense));
  const todayCashNet = netForPaymentMode(todayTransactions, 'cash');
  const todayUpiNet = netForPaymentMode(todayTransactions, 'upi');

  const allCategoriesList = buildQuickAddCategories(layoutCategoryOptions(layoutSchema));

  return (
    <div className="animate-fade-in w-full">
      {/* KPI Cards — Always same row */}
      <TodayKpiCards
        todayIncome={todayIncome}
        todayExpense={todayExpense}
        todayNet={todayNet}
        todayCashNet={todayCashNet}
        todayUpiNet={todayUpiNet}
        highestExpenseCategory={highestExpenseCategory}
        weekIncome={elapsed.map((d) => d.income)}
        weekExpense={elapsed.map((d) => d.expense)}
      />

      {/* Row 2: Income & Expenses */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-6 mb-8 items-start">
        <DonutBreakdownCard variant="income" total={todayIncome} segments={todayIncomeSegments} />
        <DonutBreakdownCard variant="expense" total={todayExpense} segments={todayExpenseSegments} />
      </div>

      {/* Quick Add Transaction */}
      {canCreate && <QuickAddBar categories={allCategoriesList} onPick={(qa) => openTransactionForm(undefined, { category: qa.label, type: qa.type })} />}

      <TodayLedger
        today={today}
        todayIncome={todayIncome}
        todayExpense={todayExpense}
        todayNet={todayNet}
        todayTransactions={todayTransactions}
        onOpen={openTransactionDetails}
        onEdit={(id) => openTransactionForm(id)}
        onDelete={deleteTransaction}
        canEdit={canEdit}
        canDelete={canDelete}
      />

      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 mb-4">
        <div>
          <h2 className="text-lg sm:text-xl font-black text-slate-950 tracking-tight">Weekly performance</h2>
          <p className="text-xs sm:text-sm font-semibold text-slate-600 mt-0.5">Expenses, income and net movement for this week</p>
        </div>
        <span className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-slate-200 bg-white/90 px-3 py-1.5 text-xs font-bold text-slate-600 shadow-sm backdrop-blur">
          <i className="ph-bold ph-calendar-blank text-indigo-500" aria-hidden="true"></i>
          This week · {rangeLabel}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 xl:gap-5 mb-8 items-stretch md:[&>*:last-child]:col-span-2 xl:[&>*:last-child]:col-span-1">
        <ExpenseHeatmapCard totalExpenses={week.totals.expense} donutSegments={donutSegments} />
        <IncomeFlowChart days={week.days} weekIncome={week.totals.income} previousWeekIncome={week.previous.income} />
        <NetTrendChart days={week.days} weekNet={week.totals.net} previousWeekNet={week.previous.net} />
      </div>

      {/* Smart Insight Banner */}
      <SmartInsightBanner topExpense={highestExpenseCategory} week={week} />
    </div>
  );
}

export default function OverviewPage() {
  return (
    <PageReveal>
      <OverviewPageContent />
    </PageReveal>
  );
}
