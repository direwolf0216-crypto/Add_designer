import React, { Component, ReactNode, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { GlassCard } from './vibrant';
import { formatCompactINR, formatINR } from '@/lib/money';
import { toBusinessISODate } from '@/lib/dates';

interface RevenueChartProps {
  data: { date: string; income: number; expense: number }[];
  /** Kept for callers; the totals are shown in the KPI strip above the chart. */
  periodIncome?: number;
  periodExpense?: number;
}

const INCOME = '#10b981';
const EXPENSE = '#f43f5e';

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full items-center text-[14px] text-subtle">
          Couldn&apos;t draw the chart.
        </div>
      );
    }
    return this.props.children;
  }
}

const formatYAxis = (tick: number) => (tick === 0 ? '₹0' : formatCompactINR(tick));

/** Chart dates are `yyyy-MM-dd` calendar days; read them as UTC so the day never shifts. */
const formatDay = (dateStr: string) =>
  new Date(`${dateStr}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });

function periodLabel(data: { date: string }[]) {
  if (data.length === 0) return '';
  const first = data[0].date;
  const last = data[data.length - 1].date;
  const year = new Date(`${last}T00:00:00Z`).getUTCFullYear();
  return first === last ? `${formatDay(first)} ${year}` : `${formatDay(first)} – ${formatDay(last)} ${year}`;
}

const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="min-w-[180px] rounded-2xl border border-white/80 bg-white/95 px-4 py-3 text-[13px] shadow-[0_18px_40px_-12px_rgba(15,23,42,0.25)] backdrop-blur">
      <p className="mb-1.5 text-xs font-bold text-slate-400">{formatDay(label)}</p>
      {[...payload].sort((a: any) => (a.dataKey === 'income' ? -1 : 1)).map((entry: any) => (
        <div key={entry.dataKey} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-subtle">
            <span className="size-2 rounded-full" style={{ backgroundColor: entry.color }} aria-hidden="true" />
            {entry.name}
          </span>
          <span className="num font-extrabold text-slate-900">{formatINR(entry.value ?? 0)}</span>
        </div>
      ))}
    </div>
  );
};

export default function RevenueChart({ data, periodIncome, periodExpense }: RevenueChartProps) {
  // Days after today have no takings yet: stop the lines at today instead of dropping them to zero.
  const series = useMemo(() => {
    const today = toBusinessISODate();
    return (data ?? []).map((d) => (d.date > today ? { date: d.date, income: null, expense: null } : d));
  }, [data]);

  const hasData = series.length > 0;

  return (
    <GlassCard
      icon="ph-chart-line-up"
      tone="emerald"
      title="Revenue vs. expenses"
      subtitle={hasData ? `Daily · ${periodLabel(series)}` : 'Trend over the selected period'}
    >
      <div className="mb-2 flex flex-wrap items-center gap-x-6 gap-y-2">
        <span className="flex items-center gap-2 text-sm">
          <span className="size-2.5 rounded-full" style={{ backgroundColor: INCOME }} aria-hidden="true" />
          <span className="font-semibold text-slate-500">Income</span>
          {typeof periodIncome === 'number' && <span className="num font-extrabold text-slate-900">{formatINR(periodIncome)}</span>}
        </span>
        <span className="flex items-center gap-2 text-sm">
          <span className="size-2.5 rounded-full" style={{ backgroundColor: EXPENSE }} aria-hidden="true" />
          <span className="font-semibold text-slate-500">Expense</span>
          {typeof periodExpense === 'number' && <span className="num font-extrabold text-slate-900">{formatINR(periodExpense)}</span>}
        </span>
      </div>

      <div className="h-[240px] w-full sm:h-[300px]">
        {hasData ? (
          <ErrorBoundary>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="rev-income" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={INCOME} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={INCOME} stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="rev-expense" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={EXPENSE} stopOpacity={0.25} />
                    <stop offset="100%" stopColor={EXPENSE} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#eef2f7" strokeDasharray="4 4" />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDay}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 600 }}
                  dy={8}
                  minTickGap={36}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tickFormatter={formatYAxis}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 600 }}
                  tickCount={5}
                  width={64}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' }} isAnimationActive={false} />
                <Area
                  type="monotone"
                  dataKey="expense"
                  name="Expense"
                  stroke={EXPENSE}
                  strokeWidth={2.5}
                  fill="url(#rev-expense)"
                  dot={false}
                  activeDot={{ r: 5, strokeWidth: 3, stroke: '#fff', fill: EXPENSE }}
                  connectNulls={false}
                  animationDuration={600}
                />
                <Area
                  type="monotone"
                  dataKey="income"
                  name="Income"
                  stroke={INCOME}
                  strokeWidth={2.5}
                  fill="url(#rev-income)"
                  dot={false}
                  activeDot={{ r: 5, strokeWidth: 3, stroke: '#fff', fill: INCOME }}
                  connectNulls={false}
                  animationDuration={600}
                />
              </AreaChart>
            </ResponsiveContainer>
          </ErrorBoundary>
        ) : (
          <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-slate-200 text-sm font-medium text-slate-400">
            No income or expenses recorded in this period.
          </div>
        )}
      </div>
    </GlassCard>
  );
}
