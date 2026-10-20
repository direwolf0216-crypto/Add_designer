// Money helpers. Amounts are stored as floating-point rupees, so every computed value is rounded
// to paise before it is persisted or compared.

/** Round to 2 decimal places (paise), avoiding binary-float artefacts like 0.1 + 0.2. */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Parse user input such as "1,25,000.50" or "₹ 500" into a non-negative number (0 when invalid). */
export function parseAmount(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? round2(value) : 0;
  if (typeof value !== "string") return 0;
  const n = Number.parseFloat(value.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? round2(n) : 0;
}

/** Sum amounts with rounding. */
export function sumAmounts(values: Iterable<number>): number {
  let total = 0;
  for (const v of values) total += v;
  return round2(total);
}

export type BalanceInput = {
  packageAmount: number;
  discount?: number;
  /** INCOME transactions linked to the job that are not deleted. */
  payments: { amount: number }[];
};

export type Balance = { total: number; paid: number; due: number };

/**
 * The single definition of a job's balance: package − discount − Σ payments received.
 * Used by the job form, details view, invoice, dashboards and reminder crons.
 */
export function computeBalance({ packageAmount, discount = 0, payments }: BalanceInput): Balance {
  const total = round2(Math.max(0, packageAmount - discount));
  const paid = sumAmounts(payments.map((p) => p.amount));
  return { total, paid, due: round2(Math.max(0, total - paid)) };
}

export function formatINR(value: number, symbol = "₹"): string {
  return `${symbol}${round2(value).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}
