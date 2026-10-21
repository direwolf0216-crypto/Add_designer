"use client";

import { useState } from "react";
import Link from "next/link";
import type { HeatmapSegment } from "@/lib/transactions/analytics";
import Amount from "@/components/data/Amount";

interface ExpenseHeatmapCardProps {
  totalExpenses: number;
  /** This week's segments, largest first (see buildHeatmapSegments). */
  donutSegments: HeatmapSegment[];
}

/** This week's expense split by category: donut plus the top four categories. */
export function ExpenseHeatmapCard({ totalExpenses, donutSegments }: ExpenseHeatmapCardProps) {
  const [hovered, setHovered] = useState<string | null>(null);
  const active = donutSegments.find((s) => s.category === hovered);

  return (
    <div className="flex h-full flex-col rounded-[24px] border border-slate-100 bg-white p-5 shadow-[0_12px_36px_rgba(15,23,42,0.06)] xl:p-6">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F0F2FF] text-[#4F46E5]">
          <i className="ph-bold ph-chart-pie-slice text-xl" aria-hidden="true"></i>
        </div>
        <div className="min-w-0">
          <h2 className="text-base font-black leading-tight text-slate-900">Expense split</h2>
          <p className="mt-1 text-xs font-bold text-slate-500">By category · this week</p>
        </div>
      </div>

      <div className="mb-5 grid flex-1 grid-cols-1 items-center gap-5 min-[430px]:grid-cols-[136px_minmax(0,1fr)] lg:grid-cols-1 2xl:grid-cols-[136px_minmax(0,1fr)]">
        <div className="relative mx-auto flex h-[136px] w-[136px] shrink-0 items-center justify-center">
          <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90 overflow-visible" aria-hidden="true">
            <circle cx="50" cy="50" r="40" fill="none" stroke="#f1f5f9" strokeWidth="12" />
            {totalExpenses > 0 &&
              donutSegments.map((seg, i) => (
                <circle
                  key={seg.category}
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke={seg.color.stroke}
                  strokeWidth={hovered === seg.category ? 15 : 12}
                  strokeDasharray={seg.dasharray}
                  strokeDashoffset={seg.dasharray}
                  transform={`rotate(${seg.rotation} 50 50)`}
                  className={`transition-all duration-300 ${hovered && hovered !== seg.category ? "opacity-40" : ""}`}
                  onMouseEnter={() => setHovered(seg.category)}
                  onMouseLeave={() => setHovered(null)}
                >
                  <animate attributeName="stroke-dashoffset" from={seg.dasharray} to={seg.dashoffset} dur="1s" begin={`${200 + i * 80}ms`} fill="freeze" />
                </circle>
              ))}
          </svg>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-5 text-center">
            <span className="mb-0.5 truncate text-[0.6rem] font-bold uppercase tracking-widest text-slate-400">{active ? active.category : "Total"}</span>
            <Amount value={active ? active.amount : totalExpenses} maxChars={8} className="text-base font-black leading-none text-slate-900" />
          </div>
        </div>

        <ul className="mx-auto flex w-full max-w-md flex-col justify-center gap-2.5">
          {donutSegments.slice(0, 4).map((seg) => (
            <li
              key={seg.category}
              className="flex cursor-default items-center gap-2.5 rounded-xl px-1 py-0.5 transition-colors hover:bg-slate-50"
              onMouseEnter={() => setHovered(seg.category)}
              onMouseLeave={() => setHovered(null)}
            >
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${seg.color.bg} ${seg.color.text}`}>
                <i className={`ph-fill ${seg.icon} text-base`} aria-hidden="true"></i>
              </div>
              <span className="min-w-0 flex-1 truncate text-xs font-bold text-slate-800 xl:text-[0.8rem]">{seg.category}</span>
              <div className="flex shrink-0 flex-col items-end">
                <span className="text-xs font-black text-slate-800">{Math.round(seg.pct * 100)}%</span>
                <Amount value={seg.amount} maxChars={10} className="whitespace-nowrap text-[0.65rem] font-bold text-slate-400" />
              </div>
            </li>
          ))}
          {donutSegments.length === 0 && <li className="py-4 text-center text-xs text-slate-400">No expenses recorded this week.</li>}
        </ul>
      </div>

      <div className="mt-auto pt-2">
        <Link href="/transactions/allTransactions?view=week&type=EXPENSE" className="flex w-fit items-center gap-2 text-sm font-extrabold text-[#4F46E5] hover:text-indigo-700">
          View all expenses <i className="ph-bold ph-arrow-right" aria-hidden="true"></i>
        </Link>
      </div>
    </div>
  );
}
