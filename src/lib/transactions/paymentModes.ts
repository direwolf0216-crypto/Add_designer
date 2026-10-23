// How the day's money splits by payment mode: Cash, UPI, Bank, and Other for anything else
// (Cheque, Card, a custom mode, or none), so the buckets always add up to the day's totals.
import { round2 } from "@/lib/money";

export type ModeKey = "cash" | "upi" | "bank" | "other";
export const MODE_KEYS: ModeKey[] = ["cash", "upi", "bank", "other"];
export type ModeFigures = { income: number; expense: number; net: number };
export type ModeSplit = Record<ModeKey, ModeFigures>;

/** The bucket a stored payment mode belongs to. Matching ignores case and surrounding spaces. */
export function paymentModeKey(mode: string | null | undefined): ModeKey {
  const m = (mode ?? "").trim().toLowerCase();
  if (/[/,+&]/.test(m)) return "other"; // a mix such as "Cash/UPI" can't be placed in one bucket
  if (m === "cash") return "cash";
  if (/^upi\b/.test(m)) return "upi";
  if (m === "bank" || m.startsWith("bank ") || /^(neft|rtgs|imps)\b/.test(m)) return "bank";
  return "other";
}

export function emptyModeSplit(): ModeSplit {
  return { cash: { income: 0, expense: 0, net: 0 }, upi: { income: 0, expense: 0, net: 0 }, bank: { income: 0, expense: 0, net: 0 }, other: { income: 0, expense: 0, net: 0 } };
}

/** Income, expense and net per bucket, rounded to paise. Rows of any other type are ignored. */
export function splitByPaymentMode(rows: Iterable<{ type: string; paymentMode?: string | null; amount: number | null | undefined }>): ModeSplit {
  const raw = emptyModeSplit();
  for (const row of rows) {
    if (row.type !== "INCOME" && row.type !== "EXPENSE") continue;
    const amount = Number(row.amount ?? 0);
    if (!Number.isFinite(amount)) continue;
    raw[paymentModeKey(row.paymentMode)][row.type === "INCOME" ? "income" : "expense"] += amount;
  }
  const out = emptyModeSplit();
  for (const k of MODE_KEYS) {
    const income = round2(raw[k].income);
    const expense = round2(raw[k].expense);
    out[k] = { income, expense, net: round2(income - expense) };
  }
  return out;
}

/** True when some of the day's money is in the Other bucket, so its chip should show. */
export const hasOtherModes = (split: ModeSplit) => split.other.income !== 0 || split.other.expense !== 0;
