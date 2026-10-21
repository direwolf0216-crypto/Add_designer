"use client";

import { useGlobalForm } from "@/components/providers/GlobalFormProvider";
import {
  buildHeatmapSegments,
  buildQuickAddCategories,
  buildTodaySegments,
  currentWeek,
  dailyFlows,
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

function OverviewPageContent() {
  const { openTransactionForm, openTransactionDetails } = useGlobalForm();
  const { data, isLoading, layoutSchema, deleteTransaction } = useTransactionsOverview();

  if (isLoading || !data) {
    return <div className="flex justify-center items-center h-64"><div className="animate-pulse w-8 h-8 rounded-full bg-orange-500"></div></div>;
  }

  const {
    totalIncome = 0,
    totalExpenses = 0,
    expensesByCategory = {},
    recentTransactions: transactions = [],
    todayTransactions = [],
    todayIncome = 0,
    todayExpense = 0,
    todayNet = 0
  } = data;

  const today = new Date();

  // Period expense split (largest first) and this week's daily flows.
  const donutSegments = buildHeatmapSegments(expensesByCategory, totalExpenses);
  const highestExpenseCategory = donutSegments.length > 0 ? donutSegments[0] : null;
  const { dates: weekDates, dayLabels } = currentWeek(today);
  const { income: actualFlow, net: netFlow } = dailyFlows(transactions, weekDates);

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
      />

      {/* Row 2: Income & Expenses */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 mb-8 items-start">
        <DonutBreakdownCard variant="income" total={todayIncome} segments={todayIncomeSegments} />
        <DonutBreakdownCard variant="expense" total={todayExpense} segments={todayExpenseSegments} />
      </div>

      {/* Quick Add Transaction */}
      <QuickAddBar categories={allCategoriesList} onPick={(qa) => openTransactionForm(undefined, { category: qa.label, type: qa.type })} />

      <TodayLedger
        today={today}
        todayIncome={todayIncome}
        todayExpense={todayExpense}
        todayNet={todayNet}
        todayTransactions={todayTransactions}
        onOpen={openTransactionDetails}
        onEdit={(id) => openTransactionForm(id)}
        onDelete={deleteTransaction}
      />

      <div className="flex items-end justify-between gap-4 mb-4">
        <div>
          <h2 className="text-lg sm:text-xl font-black text-slate-950 tracking-tight">Weekly performance</h2>
          <p className="text-xs sm:text-sm font-semibold text-slate-400 mt-0.5">Expenses, income, and net movement in one view</p>
        </div>
        <span className="hidden sm:inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-500 shadow-sm">
          <i className="ph-bold ph-calendar-blank text-indigo-500"></i>
          Last 7 days
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 xl:gap-5 mb-8 items-stretch">
        <ExpenseHeatmapCard totalExpenses={totalExpenses} donutSegments={donutSegments} />
        <IncomeFlowChart totalIncome={totalIncome} dayLabels={dayLabels} actualFlow={actualFlow} />
        <NetTrendChart dayLabels={dayLabels} netFlow={netFlow} />
      </div>

      {/* Smart Insight Banner */}
      <SmartInsightBanner highestExpenseCategory={highestExpenseCategory} />
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
