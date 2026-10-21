import type { CategoryShare } from "@/lib/transactions/analytics";
import type { WeekSummary } from "@/lib/transactions/weekly";
import { percentChange } from "@/lib/money";
import Amount from "@/components/data/Amount";
import DeltaBadge from "./DeltaBadge";

interface SmartInsightBannerProps {
  topExpense: CategoryShare | null;
  week: WeekSummary;
}

/** Insight strip under the weekly charts, computed from this week's and last week's real totals. */
export function SmartInsightBanner({ topExpense, week }: SmartInsightBannerProps) {
  const daysElapsed = Math.max(1, week.days.filter((d) => !d.isFuture).length);
  const avgIncome = week.totals.income / daysElapsed;
  const prevAvgIncome = week.previous.income / 7;
  const expenseChange = percentChange(week.totals.expense, week.previous.expense);

  return (
    <div className="mb-8 flex flex-col items-center gap-6 rounded-[2rem] border border-[#FFE8D6] bg-gradient-to-br from-[#FFF7F0] to-white p-6 shadow-sm sm:p-8 xl:flex-row">
      <div className="flex w-full flex-1 items-center gap-5">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#FFE6D5]">
          <i className="ph-fill ph-lightbulb text-[1.8rem] text-[#F97316]" aria-hidden="true"></i>
        </div>
        <div>
          <h3 className="mb-1 text-[1.15rem] font-black text-slate-900">This week at a glance</h3>
          <p className="text-[0.9rem] font-medium text-slate-600">
            {topExpense ? (
              <>
                Biggest expense: <span className="font-bold text-slate-800">{topExpense.category}</span> (<Amount value={topExpense.amount} />,{" "}
                {Math.round(topExpense.pct * 100)}% of spending).
              </>
            ) : (
              "No expenses recorded this week yet."
            )}
          </p>
        </div>
      </div>

      <div className="flex w-full flex-col items-stretch gap-4 sm:flex-row xl:w-auto">
        <div className="flex min-w-[240px] flex-1 items-center gap-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50">
            <i className="ph-bold ph-currency-inr text-xl text-emerald-600" aria-hidden="true"></i>
          </div>
          <div className="min-w-0">
            <p className="mb-0.5 text-[0.75rem] font-bold text-slate-500">Avg. daily income</p>
            <Amount value={avgIncome} className="block truncate text-[1.15rem] font-black text-emerald-600" />
            <div className="mt-1">
              <DeltaBadge change={percentChange(avgIncome, prevAvgIncome)} />
            </div>
          </div>
        </div>

        <div className="flex min-w-[240px] flex-1 items-center gap-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50">
            <i className="ph-bold ph-receipt text-xl text-sky-600" aria-hidden="true"></i>
          </div>
          <div className="min-w-0">
            <p className="mb-0.5 text-[0.75rem] font-bold text-slate-500">Spending this week</p>
            <Amount value={week.totals.expense} className="block truncate text-[1.15rem] font-black text-sky-600" />
            <div className="mt-1">
              {/* Less spending is good: green when it went down. */}
              <DeltaBadge change={expenseChange} invert />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
