"use client";

import useSWR from "swr";
import { Suspense, useState, useMemo, type ReactNode } from "react";
import { useGlobalForm } from "@/components/providers/GlobalFormProvider";
import OverdueJobBanners, { useOverdueJobs } from "@/components/jobs/OverdueJobBanners";
import DashboardDateRangePicker from "@/components/dashboard/DashboardDateRangePicker";
import dynamic from "next/dynamic";

import JobBreakdown from "@/components/dashboard/JobBreakdown";
import QuickActions from "@/components/dashboard/QuickActions";
import TaskAlerts from "@/components/dashboard/TaskAlerts";
import StatCards from "@/components/dashboard/StatCards";
import PressPipeline from "@/components/dashboard/PressPipeline";
import { GlassCard, HeaderLink, KpiTile, ModeChip, type Tone } from "@/components/dashboard/vibrant";
import { usePermissions } from "@/hooks/usePermissions";
import PageReveal from "@/components/motion/PageReveal";
import { formatINR } from "@/lib/money";
import PrinterLoader from "@/components/motion/PrinterLoader";
import { useRevealAfterLoad } from "@/components/motion/useRevealAfterLoad";
import { DASHBOARD_OVERVIEW_KEY } from "@/lib/warmPageData";

// recharts is heavy; keep it out of the initial dashboard bundle.
const RevenueChart = dynamic(() => import("@/components/dashboard/RevenueChart"), {
  ssr: false,
  loading: () => (
    <div className="rounded-card border border-line bg-surface p-5" aria-busy="true">
      <div className="skeleton h-4 w-44" />
      <div className="skeleton mt-4 h-[260px] w-full" />
    </div>
  ),
});

const fetcher = async (url: string) => {
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to fetch');
  if (data.error) throw new Error(data.error);
  return data;
};

type DateRange = { startDate: Date; endDate: Date };

const shortDate = (d: string | Date) =>
  new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

function Card({ title, subtitle, action, children, icon = "ph-squares-four", tone = "slate" }: { title: string; subtitle?: ReactNode; action?: ReactNode; children: ReactNode; icon?: string; tone?: Tone }) {
  return (
    <GlassCard icon={icon} tone={tone} title={title} subtitle={subtitle} action={action}>
      {children}
    </GlassCard>
  );
}

const viewLink = (href: string, label = "View all") => <HeaderLink href={href}>{label}</HeaderLink>;

function DashboardMetrics({
  data, error, isLoading, retry, periodLabel, overdueCount,
}: {
  data: any;
  error: any;
  isLoading: boolean;
  retry: () => void;
  periodLabel: string;
  overdueCount: number;
}) {
  const { openJobDetails, openTransactionDetails } = useGlobalForm();
  const { checkPermission } = usePermissions();
  const canViewAnalytics = checkPermission('view_export_analytics');

  const reveal = useRevealAfterLoad(isLoading && !data);
  if (isLoading && !data) return <PrinterLoader label="Printing your dashboard" />;
  if (error || !data) {
    return (
      <div className="rounded-card border border-line bg-surface p-5">
        <h2 className="text-[16px] font-semibold text-ink">Dashboard</h2>
        <p className="mt-2 text-[14px] text-subtle">
          <i className="ph ph-warning-circle mr-1.5 align-[-2px] text-[16px] text-negative" aria-hidden="true"></i>
          Couldn&apos;t load the dashboard{error?.message ? ` (${error.message})` : ''}.{' '}
          <button type="button" onClick={retry} className="font-medium text-brand hover:underline">Retry</button>
        </p>
      </div>
    );
  }

  const {
    totalJobs,
    upcomingJobs,
    transactions,
    periodIncome,
    periodExpense,
    periodNet,
    pendingProofs,
    revenueChartData,
    jobBreakdownData,
    unconfirmedJobsCount,
    pipeline,
    periodByMode,
  } = data;
  type ModeTotals = { income: number; expense: number; net: number };
  const mode = (m: "cash" | "upi"): ModeTotals => periodByMode?.[m] ?? { income: 0, expense: 0, net: 0 };
  const split = (pick: (t: ModeTotals) => number, signed = false) => (
    <div className="flex gap-2">
      <ModeChip icon="ph-fill ph-money" iconClass="text-emerald-600" label="Cash" value={pick(mode("cash"))} signed={signed} />
      <ModeChip icon="ph-bold ph-qr-code" iconClass="text-indigo-600" label="UPI" value={pick(mode("upi"))} signed={signed} />
    </div>
  );

  const net = typeof periodNet === 'number' ? periodNet : (periodIncome ?? 0) - (periodExpense ?? 0);
  const kpis: { label: string; value: ReactNode; caption?: ReactNode; icon: string; tone: Tone; valueClass?: string; extra?: ReactNode }[] = [
    ...(canViewAnalytics
      ? [
          { label: 'Income', value: formatINR(periodIncome ?? 0), caption: `Received ${periodLabel}`, icon: 'ph-trend-up', tone: 'emerald' as Tone, extra: split((t) => t.income) },
          { label: 'Expenses', value: formatINR(periodExpense ?? 0), caption: `Paid ${periodLabel}`, icon: 'ph-trend-down', tone: 'rose' as Tone, extra: split((t) => t.expense) },
          { label: 'Net', value: `${net > 0 ? '+' : ''}${formatINR(net)}`, caption: 'Income less expenses', icon: 'ph-wallet', tone: 'orange' as Tone, valueClass: net >= 0 ? 'text-emerald-600' : 'text-rose-600', extra: split((t) => t.net, true) },
        ]
      : []),
    {
      icon: 'ph-briefcase',
      tone: 'sky' as Tone,
      label: 'Jobs booked',
      value: (totalJobs ?? 0).toLocaleString('en-IN'),
      caption: overdueCount > 0
        ? `${overdueCount.toLocaleString('en-IN')} overdue overall`
        : 'None overdue',
    },
  ];
  const kpiCols = kpis.length === 4 ? 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-4' : kpis.length === 1 ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2';

  return (
    <div className={`flex flex-col gap-6 ${reveal}`}>
      <section aria-label="Overview" className={`grid gap-4 ${kpiCols}`}>
        {kpis.map((k, i) => (
          <div key={k.label} className="animate-rise h-full" style={{ ['--i' as string]: i }}>
            <KpiTile {...k} />
          </div>
        ))}
      </section>

      {Array.isArray(pipeline) && pipeline.length > 0 && <PressPipeline stages={pipeline} />}

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px] xl:grid-rows-[auto_1fr]">
        {canViewAnalytics && (
          <div className="min-w-0 xl:col-start-1 xl:row-start-1">
            <RevenueChart data={revenueChartData} periodIncome={periodIncome} periodExpense={periodExpense} />
          </div>
        )}

        <div className="flex min-w-0 flex-col gap-6 xl:col-start-2 xl:row-span-2 xl:row-start-1">
          <OverdueJobBanners />
          <TaskAlerts unconfirmedCount={unconfirmedJobsCount} pendingProofs={pendingProofs} />
          <Card title="Coming up" icon="ph-calendar-check" tone="violet" action={viewLink('/jobs?view=schedule', 'Schedule')}>
            {(!upcomingJobs || upcomingJobs.length === 0) ? (
              <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-3 text-sm font-medium text-slate-500">
                No jobs booked from today on.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {upcomingJobs.slice(0, 3).map((job: any) => (
                  <button
                    key={job.id}
                    type="button"
                    onClick={() => openJobDetails(job.id)}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-violet-100 bg-gradient-to-r from-violet-50/80 to-white px-3 py-2.5 text-left transition-[box-shadow,transform] duration-200 hover:-translate-y-px hover:shadow-md"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-violet-500 shadow-sm ring-1 ring-violet-100">
                      <i className="ph-fill ph-printer text-[16px]" aria-hidden="true"></i>
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold text-slate-900">{job.client?.name || 'Unknown client'}</span>
                      <span className="num block truncate text-xs font-medium text-slate-500">
                        {shortDate(job.date)}{job.time ? `, ${job.time}` : ''}{job.location ? ` · ${job.location}` : ''}
                      </span>
                    </span>
                    </span>
                    <span className="num shrink-0 text-sm font-extrabold text-slate-900">{formatINR(job.order?.package ?? 0)}</span>
                  </button>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className={`min-w-0 xl:col-start-1 ${canViewAnalytics ? 'xl:row-start-2' : 'xl:row-start-1'}`}>
          <div className="flex flex-col gap-6">
            <StatCards />
          </div>
        </div>
      </div>

      {/* Finishing work and recent transactions share one row: same top, same height. */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 [&>section]:min-w-0 [&>section]:flex-1">
          <JobBreakdown data={jobBreakdownData} />
        </div>
        <div className="flex min-w-0 [&>section]:min-w-0 [&>section]:flex-1">
          <Card title="Recent transactions" subtitle="Latest money in and out" icon="ph-receipt" tone="emerald" action={<HeaderLink href="/transactions" tone="emerald">View all</HeaderLink>}>
            {(!transactions || transactions.length === 0) ? (
              <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-3 text-sm font-medium text-slate-500">
                No transactions in this period.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {transactions.slice(0, 5).map((txn: any) => {
                  const title = txn.description ? txn.description.split(' - ')[0] : txn.category;
                  const isIncome = txn.type === 'INCOME';
                  return (
                    <button
                      key={txn.id}
                      type="button"
                      onClick={() => openTransactionDetails(txn.id)}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white/70 px-3 py-2.5 text-left transition-[box-shadow,transform] duration-200 hover:-translate-y-px hover:shadow-md"
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white shadow-md ${isIncome ? 'bg-gradient-to-br from-emerald-500 to-teal-500 shadow-emerald-500/30' : 'bg-gradient-to-br from-rose-500 to-red-500 shadow-rose-500/30'}`}>
                          <i className={`ph-bold ${isIncome ? 'ph-arrow-down-left' : 'ph-arrow-up-right'} text-[15px]`} aria-hidden="true"></i>
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-bold text-slate-900">{title}</span>
                          <span className="block truncate text-xs font-medium text-slate-500">
                            {txn.category} · {txn.paymentMode}
                          </span>
                        </span>
                      </span>
                      <span className="flex shrink-0 flex-col items-end">
                        <span className={`num text-sm font-extrabold ${isIncome ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {isIncome ? '+' : '−'}{formatINR(Math.abs(txn.amount))}
                        </span>
                        <span className="num text-[11px] font-semibold text-slate-400">
                          {shortDate(txn.date)}, {new Date(txn.date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function OverviewPageContent() {
  const [dateRange, setDateRange] = useState<DateRange | null>(null);
  const [periodLabel, setPeriodLabel] = useState('this month');
  const { checkPermission } = usePermissions();
  const canViewAnalytics = checkPermission('view_export_analytics');

  const query = useMemo(() => {
    if (!dateRange) return '';
    return `?startDate=${dateRange.startDate.toISOString()}&endDate=${dateRange.endDate.toISOString()}`;
  }, [dateRange]);

  // Keep the last period's figures on screen while the next one loads (no layout flash).
  const { data, error, isLoading, mutate } = useSWR(`${DASHBOARD_OVERVIEW_KEY}${query}`, fetcher, { keepPreviousData: true });
  const { total: overdueCount } = useOverdueJobs();

  const handleRangeChange = (range: DateRange | null, label?: string) => {
    setDateRange(range);
    if (label) setPeriodLabel(label);
  };

  return (
    <section id="view-dashboard" className="flex w-full flex-col gap-6">
      {/* The title sits in the top bar; this row holds the day's actions and the period. */}
      <div className="flex flex-wrap items-center justify-end gap-2.5">
        <h1 className="sr-only">Dashboard</h1>
        <QuickActions />
      </div>

      {/* Everything but the two actions sits on one frosted glass panel. The colour glows live in their
          own clipped layer, so chart tooltips and menus are never cut off at the panel's edge. */}
      <div
        data-glass-panel
        className="relative isolate flex flex-col gap-6 rounded-[30px] border border-white/70 bg-gradient-to-br from-white/50 via-white/25 to-white/10 p-2.5 shadow-[0_34px_80px_-40px_rgba(76,29,149,0.45),inset_0_1px_0_rgba(255,255,255,0.9)] backdrop-blur-2xl backdrop-saturate-150 sm:p-5"
      >
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-[inherit]">
          <span className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-orange-400/30 blur-3xl" />
          <span className="absolute -right-20 top-[30%] h-80 w-80 rounded-full bg-fuchsia-500/25 blur-3xl" />
          <span className="absolute bottom-[15%] left-[20%] h-72 w-96 rounded-full bg-sky-400/25 blur-3xl" />
          <span className="absolute -bottom-24 -right-10 h-64 w-72 rounded-full bg-violet-500/20 blur-3xl" />
        </div>
        {/* The period picker sits right above the figures it controls. */}
        <div className="-mb-3 flex flex-wrap items-center justify-between gap-3 px-1">
          <h2 className="text-[0.78rem] font-extrabold uppercase tracking-wider text-slate-500">
            Overview <span className="font-bold normal-case tracking-normal text-slate-400">· {periodLabel}</span>
          </h2>
          <DashboardDateRangePicker onRangeChange={handleRangeChange} />
        </div>

        <Suspense fallback={<PrinterLoader label="Printing your dashboard" />}>
          <DashboardMetrics
            data={data}
            error={error}
            isLoading={isLoading}
            retry={() => mutate()}
            periodLabel={periodLabel}
            overdueCount={overdueCount}
          />
        </Suspense>
      </div>
    </section>
  );
}

export default function OverviewPage() {
  return (
    <PageReveal>
      <OverviewPageContent />
    </PageReveal>
  );
}
