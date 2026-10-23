import { describe, expect, it } from "vitest";
import { MODE_KEYS, emptyModeSplit, hasOtherModes, paymentModeKey, splitByPaymentMode } from "../paymentModes";
import { round2 } from "@/lib/money";

const row = (type: string, paymentMode: string | null | undefined, amount: number | null | undefined) => ({ type, paymentMode, amount });

describe("paymentModeKey", () => {
  it("puts the form's own modes in the right bucket", () => {
    expect(paymentModeKey("Cash")).toBe("cash");
    expect(paymentModeKey("UPI")).toBe("upi");
    expect(paymentModeKey("Bank Transfer")).toBe("bank");
    expect(paymentModeKey("Cheque")).toBe("other");
  });

  it("ignores case and spaces, and knows common bank and UPI spellings", () => {
    expect(paymentModeKey("  cash ")).toBe("cash");
    expect(paymentModeKey("upi")).toBe("upi");
    expect(paymentModeKey("UPI - GPay")).toBe("upi");
    expect(paymentModeKey("bank")).toBe("bank");
    expect(paymentModeKey("BANK TRANSFER")).toBe("bank");
    expect(paymentModeKey("NEFT")).toBe("bank");
    expect(paymentModeKey("IMPS transfer")).toBe("bank");
    expect(paymentModeKey("RTGS")).toBe("bank");
  });

  it("sends anything it can't place to Other, never to Cash", () => {
    for (const m of ["Card", "", "   ", null, undefined, "cashback", "bankrupt", "upilink", "Cash/UPI", "UPI + Cash", "Bank/Cash", "NEFT, Cash"]) expect(paymentModeKey(m), String(m)).toBe("other");
  });
});

describe("splitByPaymentMode", () => {
  it("is all zeros with no transactions", () => {
    expect(splitByPaymentMode([])).toEqual(emptyModeSplit());
    expect(hasOtherModes(splitByPaymentMode([]))).toBe(false);
  });

  it("splits income, expense and net per mode", () => {
    const split = splitByPaymentMode([
      row("INCOME", "Cash", 1000),
      row("EXPENSE", "Cash", 4000),
      row("INCOME", "UPI", 1700),
      row("INCOME", "Bank Transfer", 500),
      row("EXPENSE", "Bank Transfer", 200),
    ]);
    expect(split.cash).toEqual({ income: 1000, expense: 4000, net: -3000 });
    expect(split.upi).toEqual({ income: 1700, expense: 0, net: 1700 });
    expect(split.bank).toEqual({ income: 500, expense: 200, net: 300 });
    expect(split.other).toEqual({ income: 0, expense: 0, net: 0 });
    expect(hasOtherModes(split)).toBe(false);
  });

  it("rounds to paise without float drift", () => {
    const split = splitByPaymentMode([row("INCOME", "Cash", 0.1), row("INCOME", "Cash", 0.2), row("EXPENSE", "UPI", 0.3), row("EXPENSE", "UPI", 0.6)]);
    expect(split.cash.income).toBe(0.3);
    expect(split.upi.expense).toBe(0.9);
    expect(split.upi.net).toBe(-0.9);
    const many = splitByPaymentMode(Array.from({ length: 1000 }, () => row("INCOME", "UPI", 0.01)));
    expect(many.upi.income).toBe(10);
  });

  it("counts Cheque and unknown modes as Other, and shows the Other chip only then", () => {
    const split = splitByPaymentMode([row("INCOME", "Cheque", 750), row("EXPENSE", null, 25.5)]);
    expect(split.other).toEqual({ income: 750, expense: 25.5, net: 724.5 });
    expect(hasOtherModes(split)).toBe(true);
    expect(hasOtherModes(splitByPaymentMode([row("EXPENSE", "Card", 10)]))).toBe(true);
  });

  it("skips other types and amounts that aren't numbers", () => {
    const split = splitByPaymentMode([
      row("TRANSFER", "Cash", 999),
      row("INCOME", "Cash", null),
      row("INCOME", "Cash", undefined),
      row("INCOME", "Cash", Number.NaN),
      row("INCOME", "Cash", Number.POSITIVE_INFINITY),
      row("INCOME", "Cash", 5),
    ]);
    expect(split.cash).toEqual({ income: 5, expense: 0, net: 5 });
  });

  it("always adds up to the day's totals, whatever the mix", () => {
    const modes = ["Cash", "UPI", "Bank Transfer", "Cheque", "Card", "", "neft", "cash "];
    let seed = 7;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let run = 0; run < 200; run++) {
      const rows = Array.from({ length: 1 + Math.floor(rand() * 40) }, () =>
        row(rand() < 0.5 ? "INCOME" : "EXPENSE", modes[Math.floor(rand() * modes.length)], round2(rand() * 50000))
      );
      const split = splitByPaymentMode(rows);
      const income = round2(rows.filter((r) => r.type === "INCOME").reduce((a, r) => a + r.amount!, 0));
      const expense = round2(rows.filter((r) => r.type === "EXPENSE").reduce((a, r) => a + r.amount!, 0));
      const sum = (f: "income" | "expense" | "net") => round2(MODE_KEYS.reduce((a, k) => a + split[k][f], 0));
      expect(sum("income")).toBe(income);
      expect(sum("expense")).toBe(expense);
      expect(sum("net")).toBe(round2(income - expense));
      for (const k of MODE_KEYS) expect(split[k].net).toBe(round2(split[k].income - split[k].expense));
    }
  });
});
