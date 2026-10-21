// Weekly ledger summary for the overview page. Pure: bucketing by business (IST) calendar day.
import { toBusinessISODate } from "@/lib/dates";
import { round2 } from "@/lib/money";

export type WeekDay = {
  date: string; // yyyy-MM-dd (IST)
  label: string; // Mon..Sun
  income: number;
  expense: number;
  net: number;
  isToday: boolean;
  isFuture: boolean;
};

export type WeekTotals = { income: number; expense: number; net: number };

export type WeekSummary = {
  days: WeekDay[];
  totals: WeekTotals;
  previous: WeekTotals;
  /** Expense totals by category for the current week, largest first. */
  expensesByCategory: { category: string; amount: number }[];
};

type Row = { amount: number; type: "INCOME" | "EXPENSE"; date: Date; category: string };

const LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Add days to a yyyy-MM-dd string (calendar arithmetic, no timezone involved). */
export function addIsoDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Monday (yyyy-MM-dd) of the week containing the IST calendar day `iso`. */
export function mondayOf(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday
  return addIsoDays(iso, -(dow === 0 ? 6 : dow - 1));
}

/**
 * Summarise `rows` (covering at least the previous and current week) into the current Mon..Sun week,
 * the previous week's totals and this week's expense categories.
 */
export function buildWeekSummary(rows: Row[], todayIso: string): WeekSummary {
  const monday = mondayOf(todayIso);
  const prevMonday = addIsoDays(monday, -7);
  const days: WeekDay[] = LABELS.map((label, i) => {
    const date = addIsoDays(monday, i);
    return { date, label, income: 0, expense: 0, net: 0, isToday: date === todayIso, isFuture: date > todayIso };
  });
  const index = new Map(days.map((d, i) => [d.date, i]));
  const previous: WeekTotals = { income: 0, expense: 0, net: 0 };
  const categories = new Map<string, number>();

  for (const r of rows) {
    const day = toBusinessISODate(r.date);
    const i = index.get(day);
    if (i !== undefined) {
      if (r.type === "INCOME") days[i].income += r.amount;
      else {
        days[i].expense += r.amount;
        categories.set(r.category, (categories.get(r.category) ?? 0) + r.amount);
      }
    } else if (day >= prevMonday && day < monday) {
      if (r.type === "INCOME") previous.income += r.amount;
      else previous.expense += r.amount;
    }
  }

  for (const d of days) {
    d.income = round2(d.income);
    d.expense = round2(d.expense);
    d.net = round2(d.income - d.expense);
  }
  const totals = {
    income: round2(days.reduce((s, d) => s + d.income, 0)),
    expense: round2(days.reduce((s, d) => s + d.expense, 0)),
    net: 0,
  };
  totals.net = round2(totals.income - totals.expense);
  previous.income = round2(previous.income);
  previous.expense = round2(previous.expense);
  previous.net = round2(previous.income - previous.expense);

  return {
    days,
    totals,
    previous,
    expensesByCategory: [...categories]
      .map(([category, amount]) => ({ category, amount: round2(amount) }))
      .sort((a, b) => b.amount - a.amount),
  };
}
