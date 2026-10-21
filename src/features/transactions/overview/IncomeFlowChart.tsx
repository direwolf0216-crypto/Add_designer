"use client";

import { useState } from "react";
import Link from "next/link";
import type { WeekDay } from "@/lib/transactions/weekly";
import { formatCompactINR, percentChange } from "@/lib/money";
import { niceTicks } from "@/lib/transactions/chartScale";
import Amount from "@/components/data/Amount";
import DeltaBadge from "./DeltaBadge";

interface IncomeFlowChartProps {
  days: WeekDay[];
  weekIncome: number;
  previousWeekIncome: number;
}

/** This week's income per day. Totals match the bars; days still to come are shown as placeholders. */
export function IncomeFlowChart({ days, weekIncome, previousWeekIncome }: IncomeFlowChartProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const ticks = niceTicks(0, Math.max(...days.map((d) => d.income), 0), 4);
  const top = ticks[0] || 1;
  const best = days.reduce((bi, d, i) => (d.income > days[bi].income ? i : bi), 0);
  const focus = hovered ?? (days[best]?.income > 0 ? best : null);

  return (
    <div className="flex h-full flex-col rounded-[24px] border border-slate-100 bg-white p-5 shadow-[0_12px_36px_rgba(15,23,42,0.06)] xl:p-6">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-500">
          <i className="ph-fill ph-chart-bar text-xl" aria-hidden="true"></i>
        </div>
        <div className="min-w-0">
          <h2 className="truncate text-base font-black leading-tight text-slate-900">Income flow</h2>
          <p className="mt-1 truncate text-xs font-bold text-slate-500">Per day · this week</p>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap items-end justify-between gap-x-3 gap-y-2 rounded-2xl bg-[#FFF4ED] p-4">
        <div className="min-w-0">
          <span className="mb-1 block text-xs font-bold text-slate-500">Income this week</span>
          <Amount value={weekIncome} className="block whitespace-nowrap text-2xl font-black leading-none text-[#F97316]" />
        </div>
        <DeltaBadge change={percentChange(weekIncome, previousWeekIncome)} />
      </div>

      <div className="mt-auto flex w-full flex-col">
        <div className="relative mb-5 flex h-[178px]">
          <div className="flex w-14 shrink-0 flex-col justify-between whitespace-nowrap pb-6 pr-2 text-right text-[0.65rem] font-bold text-slate-400">
            {ticks.map((t) => (
              <span key={t}>{formatCompactINR(t)}</span>
            ))}
          </div>
          <div className="relative flex flex-1 items-end justify-between gap-1 pb-6">
            <div className="pointer-events-none absolute inset-0 flex flex-col justify-between pb-6">
              {ticks.map((t) => (
                <div key={t} className="h-px w-full border-t border-dashed border-slate-200/80" />
              ))}
            </div>
            {days.map((d, idx) => {
              const heightPct = (d.income / top) * 100;
              const isFocus = focus === idx;
              return (
                <div
                  key={d.date}
                  className="relative z-10 flex h-full w-full flex-col items-center justify-end"
                  onMouseEnter={() => setHovered(idx)}
                  onMouseLeave={() => setHovered(null)}
                >
                  <div className="relative flex h-full w-full items-end justify-center">
                    {isFocus && !d.isFuture && (
                      <span className="absolute z-20 whitespace-nowrap rounded-md bg-slate-900 px-1.5 py-0.5 text-[0.65rem] font-bold text-white shadow" style={{ bottom: `calc(${Math.max(heightPct, 3)}% + 6px)` }}>
                        <Amount value={d.income} maxChars={9} />
                      </span>
                    )}
                    {d.isFuture ? (
                      <div className="h-[6%] w-5 rounded-t-md border border-dashed border-slate-200 sm:w-6 lg:w-7" title="Upcoming" />
                    ) : (
                      <div
                        className={`w-5 rounded-t-md transition-all duration-500 sm:w-6 lg:w-7 ${isFocus ? "bg-gradient-to-t from-orange-500 to-amber-400 shadow-[0_8px_20px_-6px_rgba(249,115,22,0.6)]" : d.isToday ? "bg-orange-300" : "bg-[#FFDCC3] hover:bg-[#FFB98A]"}`}
                        style={{ height: `${Math.max(heightPct, 3)}%` }}
                      />
                    )}
                  </div>
                  <span className={`absolute -bottom-6 text-[0.65rem] font-bold uppercase ${d.isToday ? "text-orange-600" : d.isFuture ? "text-slate-300" : "text-slate-400"}`}>
                    {d.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="pt-2">
          <Link href="/transactions/allTransactions?view=week&type=INCOME" className="flex w-fit items-center gap-2 text-sm font-extrabold text-[#F97316] hover:text-orange-600">
            View income <i className="ph-bold ph-arrow-right" aria-hidden="true"></i>
          </Link>
        </div>
      </div>
    </div>
  );
}
