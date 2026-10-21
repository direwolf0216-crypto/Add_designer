"use client";

import { useState } from "react";
import Link from "next/link";
import type { WeekDay } from "@/lib/transactions/weekly";
import { formatCompactINR, percentChange } from "@/lib/money";
import { niceTicks } from "@/lib/transactions/chartScale";
import Amount from "@/components/data/Amount";
import DeltaBadge from "./DeltaBadge";

interface NetTrendChartProps {
  days: WeekDay[];
  weekNet: number;
  previousWeekNet: number;
}

const W = 280;
const H = 120;
const X0 = 14;
const X1 = 266;

/** Daily net (income − expense) this week. The line stops at today; later days are shown as upcoming. */
export function NetTrendChart({ days, weekNet, previousWeekNet }: NetTrendChartProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const elapsed = days.filter((d) => !d.isFuture);
  const values = elapsed.map((d) => d.net);
  const ticks = niceTicks(Math.min(...values, 0), Math.max(...values, 0), 4);
  const top = ticks[0];
  const bottom = ticks[ticks.length - 1];
  const range = top - bottom || 1;
  const xAt = (i: number) => X0 + (i * (X1 - X0)) / (days.length - 1);
  const yAt = (v: number) => 8 + ((top - v) / range) * (H - 16);
  const points = elapsed.map((d, i) => ({ x: xAt(i), y: yAt(d.net), day: d }));
  const zeroY = yAt(0);
  const line = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const area = points.length ? `${line} L ${points[points.length - 1].x.toFixed(1)} ${zeroY.toFixed(1)} L ${points[0].x.toFixed(1)} ${zeroY.toFixed(1)} Z` : "";
  const todayIdx = days.findIndex((d) => d.isToday);
  const active = hovered !== null && hovered < points.length ? hovered : Math.max(0, Math.min(todayIdx, points.length - 1));
  const activePoint = points[active];

  return (
    <div className="flex h-full flex-col rounded-[24px] border border-slate-100 bg-white p-5 shadow-[0_12px_36px_rgba(15,23,42,0.06)] xl:p-6">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F0F2FF] text-[#4F46E5]">
          <i className="ph-bold ph-trend-up text-xl" aria-hidden="true"></i>
        </div>
        <div className="min-w-0">
          <h2 className="truncate text-base font-black leading-tight text-slate-900">Daily net</h2>
          <p className="mt-1 text-xs font-bold text-slate-500">Income − expenses · this week</p>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="min-w-0">
          <Amount value={weekNet} className={`mb-1 block whitespace-nowrap text-2xl font-black leading-none ${weekNet < 0 ? "text-rose-600" : "text-slate-900"}`} />
          <span className="text-xs font-bold text-slate-500">Net so far this week</span>
        </div>
        <DeltaBadge change={percentChange(weekNet, previousWeekNet)} />
      </div>

      <div className="mt-auto flex w-full flex-col">
        <div className="relative mb-5 flex h-[178px]">
          <div className="flex w-14 shrink-0 flex-col justify-between whitespace-nowrap pb-6 pr-2 text-right text-[0.65rem] font-bold text-slate-400">
            {ticks.map((t) => (
              <span key={t}>{formatCompactINR(t)}</span>
            ))}
          </div>
          <div className="relative flex-1 pb-6">
            <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full overflow-visible" preserveAspectRatio="none" aria-hidden="true">
              <defs>
                <linearGradient id="netStroke" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#8b5cf6" />
                  <stop offset="100%" stopColor="#4f46e5" />
                </linearGradient>
                <linearGradient id="netFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.22" />
                  <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
                </linearGradient>
              </defs>
              <line x1={X0} y1={zeroY} x2={X1} y2={zeroY} stroke="#cbd5e1" strokeWidth="1" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
              {area && <path d={area} fill="url(#netFill)" />}
              {line && <path d={line} fill="none" stroke="url(#netStroke)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />}
              {activePoint && <line x1={activePoint.x} y1={activePoint.y} x2={activePoint.x} y2={H} stroke="#cbd5e1" strokeWidth="1" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />}
            </svg>
            {/* Points as HTML so they stay round regardless of the chart's aspect ratio. */}
            {points.map((p, i) => (
              <span
                key={p.day.date}
                className={`pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-[2.5px] ${i === active ? "border-white bg-indigo-600 shadow" : "border-indigo-600 bg-white"}`}
                style={{ left: `${(p.x / W) * 100}%`, top: `calc(${(p.y / H) * 100}% * (1 - 24 / 178))` }}
              />
            ))}
            {activePoint && (
              <div
                className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-[calc(100%+10px)] whitespace-nowrap rounded-md bg-violet-500 px-2 py-1 text-[0.7rem] font-bold text-white shadow-lg"
                style={{ left: `${(activePoint.x / W) * 100}%`, top: `calc(${(activePoint.y / H) * 100}% * (1 - 24 / 178))` }}
              >
                {activePoint.day.label} · <Amount value={activePoint.day.net} maxChars={9} />
              </div>
            )}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-between">
              {days.map((d, i) => (
                <span key={d.date} className={`text-[0.65rem] font-bold uppercase ${i === active ? "text-indigo-600" : d.isFuture ? "text-slate-300" : "text-slate-400"}`}>
                  {d.label}
                </span>
              ))}
            </div>
            <div className="absolute inset-0 z-10 flex pb-6">
              {days.map((d, i) => (
                <div key={d.date} className="h-full flex-1" onMouseEnter={() => !d.isFuture && setHovered(i)} onMouseLeave={() => setHovered(null)} />
              ))}
            </div>
          </div>
        </div>

        <div className="pt-2">
          <Link href="/transactions/allTransactions?view=week" className="flex w-fit items-center gap-2 text-sm font-extrabold text-[#4F46E5] hover:text-indigo-700">
            View full trend <i className="ph-bold ph-arrow-right" aria-hidden="true"></i>
          </Link>
        </div>
      </div>
    </div>
  );
}
