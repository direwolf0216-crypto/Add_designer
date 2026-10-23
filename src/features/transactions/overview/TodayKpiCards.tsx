import Link from "next/link";
import type { CategoryShare } from "@/lib/transactions/analytics";
import Amount from "@/components/data/Amount";
import Sparkline from "@/components/data/Sparkline";

interface TodayKpiCardsProps {
  todayIncome: number;
  todayExpense: number;
  todayNet: number;
  todayCashNet: number;
  todayUpiNet: number;
  /** Largest expense category this week (null when there are no expenses). */
  highestExpenseCategory: CategoryShare | null;
  /** Daily income / expense this week up to today, for the sparklines. */
  weekIncome: number[];
  weekExpense: number[];
}

const CARD =
  "group relative flex h-[150px] flex-col justify-between overflow-hidden rounded-[22px] border border-slate-100/80 bg-white/90 p-5 shadow-[0_18px_45px_-20px_rgba(15,23,42,0.18)] backdrop-blur transition-all hover:-translate-y-0.5 hover:shadow-[0_22px_50px_-20px_rgba(15,23,42,0.25)] group-focus-visible:ring-2 group-focus-visible:ring-orange-300";
const LABEL = "text-[0.65rem] font-extrabold uppercase tracking-[1px] text-slate-500";

function Chip({ icon, iconClass, label, value }: { icon: string; iconClass: string; label: string; value: number }) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl bg-slate-50/90 px-2.5 py-1.5 ring-1 ring-slate-100">
      <i className={`${icon} ${iconClass} text-base`} aria-hidden="true"></i>
      <div className="min-w-0">
        <p className="text-[0.55rem] font-extrabold uppercase tracking-wider text-slate-400">{label}</p>
        <Amount value={value} maxChars={9} className={`block truncate text-[0.8rem] font-bold ${value < 0 ? "text-rose-600" : "text-slate-800"}`} />
      </div>
    </div>
  );
}

/** Today's income, expenses, net (with cash/UPI split) and the week's top expense. */
export function TodayKpiCards({ todayIncome, todayExpense, todayNet, todayCashNet, todayUpiNet, highestExpenseCategory, weekIncome, weekExpense }: TodayKpiCardsProps) {
  const pct = highestExpenseCategory ? Math.round(highestExpenseCategory.pct * 100) : 0;
  return (
    <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 min-[1400px]:grid-cols-4">
      <Link href="/transactions/allTransactions?view=day&type=INCOME" className="group block min-w-0 outline-none animate-rise" style={{ ["--i" as string]: 0 }}>
        <div className={CARD}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <span className={LABEL}>Today&apos;s income</span>
              <Amount value={todayIncome} className="mt-3 block truncate text-[1.6rem] font-black leading-none text-slate-950" />
            </div>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <i className="ph-bold ph-trend-up" aria-hidden="true"></i>
            </span>
          </div>
          <div className="flex items-end justify-between gap-2">
            <span className="whitespace-nowrap text-xs font-bold text-slate-500">This week</span>
            <Sparkline values={weekIncome} stroke={["#6ee7d3", "#10b981"]} id="spark-income" className="h-10 w-28" />
          </div>
        </div>
      </Link>

      <Link href="/transactions/allTransactions?view=day&type=EXPENSE" className="group block min-w-0 outline-none animate-rise" style={{ ["--i" as string]: 1 }}>
        <div className={CARD}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <span className={LABEL}>Today&apos;s expenses</span>
              <Amount value={todayExpense} className="mt-3 block truncate text-[1.6rem] font-black leading-none text-slate-950" />
            </div>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
              <i className="ph-bold ph-trend-down" aria-hidden="true"></i>
            </span>
          </div>
          <div className="flex items-end justify-between gap-2">
            <span className="whitespace-nowrap text-xs font-bold text-slate-500">This week</span>
            <Sparkline values={weekExpense} stroke={["#fda4af", "#ef4444"]} id="spark-expense" className="h-10 w-28" />
          </div>
        </div>
      </Link>

      <Link href="/transactions/allTransactions?view=day" className="group block min-w-0 outline-none animate-rise" style={{ ["--i" as string]: 2 }}>
        <div className={`${CARD} bg-gradient-to-br from-white to-indigo-50/60`}>
          <div className="flex items-start justify-between gap-2">
            <span className={LABEL}>Net today</span>
            <span
              className={`rounded-md px-1.5 py-0.5 text-[0.55rem] font-extrabold tracking-[0.8px] ${todayNet >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"}`}
            >
              {todayNet >= 0 ? "HEALTHY" : "DEFICIT"}
            </span>
          </div>
          <Amount
            value={todayNet}
            className={`block truncate text-[1.6rem] font-black leading-none ${todayNet < 0 ? "text-rose-600" : "text-[#1a1f36]"}`}
          />
          <div className="flex gap-2">
            <Chip icon="ph-fill ph-money" iconClass="text-emerald-600" label="Cash" value={todayCashNet} />
            <Chip icon="ph-bold ph-qr-code" iconClass="text-indigo-600" label="UPI" value={todayUpiNet} />
          </div>
        </div>
      </Link>

      <Link
        href={`/transactions/allTransactions?categories=${highestExpenseCategory ? encodeURIComponent(highestExpenseCategory.category) : ""}`}
        className="group block min-w-0 outline-none animate-rise"
        style={{ ["--i" as string]: 3 }}
      >
        <div className={CARD}>
          <span className={LABEL}>Top expense · this week</span>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[0.95rem] font-extrabold leading-tight text-slate-950">
                {highestExpenseCategory ? highestExpenseCategory.category : "No expenses yet"}
              </p>
              <p className="mt-0.5 truncate text-xs font-medium text-slate-500">
                {highestExpenseCategory ? <Amount value={highestExpenseCategory.amount} /> : "—"}
              </p>
            </div>
            <div className="relative h-[56px] w-[56px] shrink-0">
              <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90" aria-hidden="true">
                <circle cx="18" cy="18" r="15" fill="none" stroke="#eef2f7" strokeWidth="4" />
                <circle
                  cx="18"
                  cy="18"
                  r="15"
                  fill="none"
                  stroke="#6366f1"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={`${(pct / 100) * 94.25} 94.25`}
                  className="transition-[stroke-dasharray] duration-700"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-xs font-black text-slate-900">{pct}%</span>
            </div>
          </div>
          <span className="text-xs font-bold text-slate-400">of this week&apos;s expenses</span>
        </div>
      </Link>
    </div>
  );
}
