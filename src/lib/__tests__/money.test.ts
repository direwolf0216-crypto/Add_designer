import { describe, expect, it } from "vitest";
import { computeBalance, formatCompactINR, formatINR, parseAmount, percentChange, round2, sumAmounts } from "../money";

describe("money", () => {
  it("rounds to paise", () => {
    expect(round2(0.1 + 0.2)).toBe(0.3);
    expect(round2(1.005)).toBe(1.01);
  });

  it("parses Indian-formatted input", () => {
    expect(parseAmount("1,25,000.50")).toBe(125000.5);
    expect(parseAmount("₹ 500")).toBe(500);
    expect(parseAmount("abc")).toBe(0);
    expect(parseAmount(undefined)).toBe(0);
  });

  it("sums without float drift", () => {
    expect(sumAmounts([0.1, 0.2, 0.3])).toBe(0.6);
  });

  it("computes balance from package, discount and payments", () => {
    expect(computeBalance({ packageAmount: 50000, payments: [{ amount: 10000 }, { amount: 15000 }] })).toEqual({
      total: 50000,
      paid: 25000,
      due: 25000,
    });
    expect(computeBalance({ packageAmount: 1000, discount: 100, payments: [{ amount: 1200 }] })).toEqual({
      total: 900,
      paid: 1200,
      due: 0,
    });
  });
});

describe("formatting", () => {
  it("formats rupees with Indian grouping and a leading minus", () => {
    expect(formatINR(125000)).toBe("₹1,25,000");
    expect(formatINR(-22959)).toBe("\u2212₹22,959");
    expect(formatINR(49.5)).toBe("₹49.50");
  });
  it("compacts large amounts", () => {
    expect(formatCompactINR(60086094)).toBe("₹6.01 Cr");
    expect(formatCompactINR(204674)).toBe("₹2.05 L");
    expect(formatCompactINR(200000)).toBe("₹2 L");
    expect(formatCompactINR(87614)).toBe("₹87.6K");
    expect(formatCompactINR(-5000)).toBe("\u2212₹5K");
    expect(formatCompactINR(950)).toBe("₹950");
  });
  it("computes percent change", () => {
    expect(percentChange(112, 100)).toBe(12);
    expect(percentChange(50, -100)).toBe(150);
    expect(percentChange(10, 0)).toBeNull();
  });
});
