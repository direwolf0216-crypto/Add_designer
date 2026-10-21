// Pure analytics behind the transactions overview page (donuts, weekly flow, net trend, quick add).
import {
  CATEGORY_ICONS,
  QUICK_ADD_INCOME_CATEGORIES,
  getCategoryColorClasses,
  getCategoryIcon,
  getConsistentColorClasses,
  type CategoryColorClasses,
} from "./categoryTheme";
import type { TransactionRecord } from "./types";

/** Circumference of the r=40 donut circle (2 * pi * 40, rounded as the SVGs use it). */
export const DONUT_CIRCUMFERENCE = 251.2;

export interface CategoryShare {
  category: string;
  amount: number;
  /** Fraction of the total, 0..1. */
  pct: number;
}

export interface HeatmapSegment extends CategoryShare {
  dasharray: number;
  dashoffset: number;
  rotation: number;
  color: CategoryColorClasses;
  icon: string;
}

export interface TodaySegment extends CategoryShare {
  dashoffset: number;
  rotation: number;
  color: CategoryColorClasses;
}

type Tx = Pick<TransactionRecord, "type" | "category" | "amount"> & Partial<TransactionRecord>;

/** Totals per category for one transaction type. */
export function sumByCategory(transactions: Tx[], type: "INCOME" | "EXPENSE"): Record<string, number> {
  return transactions
    .filter((t) => t.type === type)
    .reduce<Record<string, number>>((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + t.amount;
      return acc;
    }, {});
}

/** Category amounts as shares of `total`, largest first. `pct` is 0 when total is not positive. */
export function toCategoryShares(byCategory: Record<string, number>, total: number): CategoryShare[] {
  return Object.entries(byCategory)
    .map(([category, amount]) => ({ category, amount, pct: total > 0 ? amount / total : 0 }))
    .sort((a, b) => b.amount - a.amount);
}

/** Donut segments for the expense heatmap (period totals). First segment is the largest category. */
export function buildHeatmapSegments(expensesByCategory: Record<string, number>, totalExpenses: number): HeatmapSegment[] {
  let cumulativePct = 0;
  return toCategoryShares(expensesByCategory, totalExpenses).map((share) => {
    const dasharray = DONUT_CIRCUMFERENCE;
    const segment: HeatmapSegment = {
      ...share,
      dasharray,
      dashoffset: dasharray - share.pct * dasharray,
      rotation: cumulativePct * 360,
      color: getCategoryColorClasses(share.category),
      icon: getCategoryIcon(share.category),
    };
    cumulativePct += share.pct;
    return segment;
  });
}

/** Donut segments for the "today" income / expense cards (start from the top, hashed colours). */
export function buildTodaySegments(shares: CategoryShare[]): TodaySegment[] {
  let cumulativePct = 0;
  return shares.map((share) => {
    const segment: TodaySegment = {
      ...share,
      dashoffset: DONUT_CIRCUMFERENCE - share.pct * DONUT_CIRCUMFERENCE,
      rotation: cumulativePct * 360 - 90, // Start from top
      color: getConsistentColorClasses(share.category),
    };
    cumulativePct += share.pct;
    return segment;
  });
}

/** Net (income minus expense) of transactions whose payment mode matches `mode`, case-insensitively. */
export function netForPaymentMode(transactions: Tx[], mode: string): number {
  return transactions
    .filter((t) => t.paymentMode?.toLowerCase() === mode)
    .reduce((acc, t) => acc + (t.type === "INCOME" ? t.amount : -t.amount), 0);
}

/** Monday..Sunday of the week containing `today` (local time), plus short en-IN weekday labels. */
export function currentWeek(today: Date): { dates: Date[]; dayLabels: string[] } {
  const dates: Date[] = [];
  const currentDayOfWeek = today.getDay();
  const daysToMonday = currentDayOfWeek === 0 ? 6 : currentDayOfWeek - 1;
  const monday = new Date(today);
  monday.setDate(today.getDate() - daysToMonday);
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(d);
  }
  return { dates, dayLabels: dates.map((d) => d.toLocaleDateString("en-IN", { weekday: "short" })) };
}

/** Daily income / expense / net totals for the given days (transactions outside them are ignored). */
export function dailyFlows(transactions: Tx[], days: Date[]): { income: number[]; expense: number[]; net: number[] } {
  const income = new Array<number>(days.length).fill(0);
  const expense = new Array<number>(days.length).fill(0);
  const dateIndexMap = new Map<string, number>();
  days.forEach((d, i) => dateIndexMap.set(d.toDateString(), i));

  transactions.forEach((t) => {
    if (!t.date) return;
    const idx = dateIndexMap.get(new Date(t.date).toDateString());
    if (idx === undefined) return;
    if (t.type === "INCOME") income[idx] += t.amount;
    else if (t.type === "EXPENSE") expense[idx] += t.amount;
  });

  return { income, expense, net: income.map((v, idx) => v - expense[idx]) };
}

export interface NetTrend {
  values: number[];
  min: number;
  max: number;
  points: { x: number; y: number; value: number }[];
  zeroY: number;
  linePath: string;
  areaPath: string;
}

/** SVG geometry for the 7-day net trend line (viewBox 280x120, plot area x 20..260, y 20..85). */
export function buildNetTrend(netFlow: number[]): NetTrend {
  const values = netFlow.length > 0 ? netFlow : new Array<number>(7).fill(0);
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 0);
  const range = Math.max(max - min, 1);
  const points = values.map((value, idx) => ({
    x: 20 + (idx * 240) / 6,
    y: 20 + ((max - value) / range) * 65,
    value,
  }));
  const zeroY = 20 + ((max - 0) / range) * 65;
  const linePath = points.map((p, idx) => `${idx === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L ${points[points.length - 1]?.x.toFixed(1) ?? 260} ${zeroY.toFixed(1)} L ${points[0]?.x.toFixed(1) ?? 20} ${zeroY.toFixed(1)} Z`;
  return { values, min, max, points, zeroY, linePath, areaPath };
}

/** Index of the largest value (first one on ties); -1 for an empty list. */
export const indexOfMax = (values: number[]) => values.indexOf(Math.max(...values));

interface LayoutSchemaLike {
  sections?: { fields: { id: string; options?: string[] }[] }[];
}

/** Category options configured on the transaction form layout (field `fld_tx_category`), if any. */
export function layoutCategoryOptions(schema: LayoutSchemaLike | null | undefined): string[] {
  let categories: string[] = [];
  if (schema?.sections) {
    for (const sec of schema.sections) {
      for (const f of sec.fields) {
        if (f.id === "fld_tx_category" && f.options) categories = f.options;
      }
    }
  }
  return categories;
}

export interface QuickAddCategory {
  label: string;
  icon: string;
  color: string;
  bg: string;
  type: "INCOME" | "EXPENSE";
}

/** Quick-add buttons: the layout's categories, or the built-in icon map's categories when none are configured. */
export function buildQuickAddCategories(layoutCategories: string[]): QuickAddCategory[] {
  const base = layoutCategories.length > 0 ? layoutCategories : Object.keys(CATEGORY_ICONS);
  return base.map((cat) => {
    const classes = getCategoryColorClasses(cat);
    return {
      label: cat,
      icon: getCategoryIcon(cat),
      color: classes.text,
      bg: classes.bg,
      type: QUICK_ADD_INCOME_CATEGORIES.includes(cat) ? "INCOME" : "EXPENSE",
    };
  });
}
