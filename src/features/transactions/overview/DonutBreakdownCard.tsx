"use client";

import { useState } from "react";
import Link from "next/link";
import { getRelatableIcon } from "@/lib/transactions/categoryTheme";
import Amount from "@/components/data/Amount";
import type { TodaySegment } from "@/lib/transactions/analytics";

type Variant = "income" | "expense";

const VARIANTS: Record<Variant, {
  title: string;
  animationDelay: string;
  headerClassName: string;
  emptyText: string;
  totalLabel: string;
  /** Legend rows shown (undefined = all). */
  legendLimit?: number;
  formatPct: (pct: number) => string;
  footerClassName: string;
  linkHref: string;
  linkClassName: string;
  linkText: string;
}> = {
  income: {
    title: "Income Sources (Today)",
    animationDelay: "300ms",
    headerClassName: "p-4 sm:p-5 pb-2",
    emptyText: "No income recorded today",
    totalLabel: "Total Income",
    formatPct: (pct) => `${Math.round(pct * 100)}`,
    footerClassName: "border-t border-slate-100 p-3 flex justify-end mt-auto",
    linkHref: "/transactions/allTransactions?view=day&type=INCOME",
    linkClassName: "text-blue-600 font-bold text-[0.8rem] hover:text-blue-700 flex items-center gap-1 px-2",
    linkText: "View all income",
  },
  expense: {
    title: "Expense Breakdown (Today)",
    animationDelay: "400ms",
    headerClassName: "p-4 sm:p-5 pb-2 flex justify-between items-start",
    emptyText: "No expenses recorded today",
    totalLabel: "Total Expense",
    legendLimit: 4,
    formatPct: (pct) => `${Math.round(pct * 100)}`,
    footerClassName: "border-t border-slate-100 p-3 flex justify-start mt-auto",
    linkHref: "/transactions/allTransactions?view=day&type=EXPENSE",
    linkClassName: "text-orange-500 font-bold text-[0.8rem] hover:text-orange-600 flex items-center gap-1 px-2",
    linkText: "View all expenses",
  },
};

interface DonutBreakdownCardProps {
  variant: Variant;
  total: number;
  segments: TodaySegment[];
}

/** Today's income-by-source or expense-by-category donut with a hover-linked legend. */
export function DonutBreakdownCard({ variant, total, segments }: DonutBreakdownCardProps) {
  const v = VARIANTS[variant];
  const [hoveredCat, setHoveredCat] = useState<string | null>(null);
  const legend = v.legendLimit ? segments.slice(0, v.legendLimit) : segments;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col h-full animate-slide-up" style={{ animationDelay: v.animationDelay }}>
      <div className={v.headerClassName}>
        <h3 className="text-[#0B1E40] font-black text-[1.05rem]">{v.title}</h3>
      </div>
      <div className="flex-1 p-4 sm:p-5 flex flex-row items-center justify-between gap-4">
        {total === 0 ? (
          <div className="w-full text-center text-slate-400 py-10 text-sm">{v.emptyText}</div>
        ) : (
          <>
            <div className="relative w-28 h-28 sm:w-32 sm:h-32 shrink-0">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                {segments.map((seg, i) => (
                  <circle
                    key={i}
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke={seg.color.stroke}
                    strokeWidth="16"
                    strokeDasharray="251.2"
                    strokeDashoffset={seg.dashoffset}
                    transform={`rotate(${seg.rotation + 90} 50 50)`}
                    className={`transition-all duration-300 ease-out cursor-pointer ${hoveredCat && hoveredCat !== seg.category ? 'opacity-30' : 'opacity-100 hover:stroke-[20px]'}`}
                    onMouseEnter={() => setHoveredCat(seg.category)}
                    onMouseLeave={() => setHoveredCat(null)}
                  />
                ))}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[0.6rem] font-bold text-slate-400">{v.totalLabel}</span>
                {/* Compact form when the full amount would not fit inside the ring. */}
                <Amount value={total} maxChars={8} className="max-w-[72%] truncate text-center text-[0.95rem] font-black text-[#0B1E40] sm:text-[1.05rem]" />
              </div>
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-3">
              {legend.map((seg, i) => {
                const iconStr = getRelatableIcon(seg.category);
                return (
                  <div
                    key={i}
                    className={`flex items-center justify-between gap-3 group cursor-default transition-all duration-300 relative ${hoveredCat === seg.category ? 'sm:translate-x-3 bg-slate-50 p-2 -mx-2 rounded-xl shadow-sm' : ''}`}
                    onMouseEnter={() => setHoveredCat(seg.category)}
                    onMouseLeave={() => setHoveredCat(null)}
                  >
                    {hoveredCat === seg.category && (
                      <div className="absolute -left-5 top-1/2 -translate-y-1/2 animate-pulse">
                        <i className={`ph-fill ph-caret-right ${seg.color.text} text-lg`}></i>
                      </div>
                    )}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-10 h-10 rounded-xl ${seg.color.bg} ${seg.color.text} flex items-center justify-center shrink-0 border border-transparent group-hover:scale-110 transition-all`}>
                        <i className={`ph-bold ${iconStr} text-xl`}></i>
                      </div>
                      <span className="text-[0.8rem] font-bold text-[#0B1E40] truncate">{seg.category}</span>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                      <Amount value={seg.amount} className="text-[0.8rem] font-bold text-[#0B1E40]" />
                      <span className="text-[0.7rem] text-slate-400 font-bold w-8 text-right">{v.formatPct(seg.pct)}%</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
      <div className={v.footerClassName}>
        <Link href={v.linkHref} className={v.linkClassName}>
          {v.linkText} <i className="ph-bold ph-arrow-right"></i>
        </Link>
      </div>
    </div>
  );
}
