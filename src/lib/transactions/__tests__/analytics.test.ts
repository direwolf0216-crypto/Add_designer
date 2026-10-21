import { describe, expect, it } from "vitest";
import {
  DONUT_CIRCUMFERENCE,
  buildHeatmapSegments,
  buildNetTrend,
  buildQuickAddCategories,
  buildTodaySegments,
  currentWeek,
  dailyFlows,
  indexOfMax,
  layoutCategoryOptions,
  netForPaymentMode,
  sumByCategory,
  toCategoryShares,
} from "../analytics";
import { CATEGORY_ICONS, getConsistentColorClasses } from "../categoryTheme";

const tx = (type: string, category: string, amount: number, extra: Record<string, unknown> = {}) => ({
  id: `${type}-${category}-${amount}`,
  date: new Date(2026, 9, 21, 10).toISOString(),
  type,
  category,
  amount,
  ...extra,
});

describe("category totals and shares", () => {
  const today = [tx("INCOME", "Xerox", 100), tx("INCOME", "PP", 50), tx("INCOME", "Xerox", 50), tx("EXPENSE", "Tea", 30)];

  it("sums per category for one type", () => {
    expect(sumByCategory(today, "INCOME")).toEqual({ Xerox: 150, PP: 50 });
    expect(sumByCategory(today, "EXPENSE")).toEqual({ Tea: 30 });
  });

  it("sorts shares largest first and guards a zero total", () => {
    expect(toCategoryShares({ PP: 50, Xerox: 150 }, 200)).toEqual([
      { category: "Xerox", amount: 150, pct: 0.75 },
      { category: "PP", amount: 50, pct: 0.25 },
    ]);
    expect(toCategoryShares({ PP: 50 }, 0)).toEqual([{ category: "PP", amount: 50, pct: 0 }]);
  });
});

describe("donut segments", () => {
  it("builds heatmap segments with cumulative rotation, predefined colours and icons", () => {
    const segs = buildHeatmapSegments({ Rent: 25, "Printing Job": 75 }, 100);
    expect(segs.map((s) => s.category)).toEqual(["Printing Job", "Rent"]);
    expect(segs[0]).toMatchObject({ pct: 0.75, dasharray: DONUT_CIRCUMFERENCE, rotation: 0, icon: "ph-printer" });
    expect(segs[0].dashoffset).toBeCloseTo(DONUT_CIRCUMFERENCE * 0.25);
    expect(segs[0].color.text).toBe("text-emerald-600");
    expect(segs[1]).toMatchObject({ rotation: 270, icon: "ph-house" });
    expect(segs[1].color.text).toBe("text-slate-600");
  });

  it("builds today segments starting from the top with hashed colours", () => {
    const segs = buildTodaySegments([
      { category: "Xerox", amount: 50, pct: 0.5 },
      { category: "PP", amount: 50, pct: 0.5 },
    ]);
    expect(segs[0]).toMatchObject({ rotation: -90, dashoffset: DONUT_CIRCUMFERENCE / 2, color: getConsistentColorClasses("Xerox") });
    expect(segs[1].rotation).toBe(90);
  });
});

describe("netForPaymentMode", () => {
  it("nets income minus expense for an exact, case-insensitive mode", () => {
    const list = [
      tx("INCOME", "A", 100, { paymentMode: "Cash" }),
      tx("EXPENSE", "B", 30, { paymentMode: "cash" }),
      tx("INCOME", "C", 999, { paymentMode: "UPI" }),
      tx("INCOME", "D", 5),
    ];
    expect(netForPaymentMode(list, "cash")).toBe(70);
    expect(netForPaymentMode(list, "upi")).toBe(999);
  });
});

describe("week and daily flows", () => {
  it("returns Monday..Sunday of the current week (Sunday belongs to the week before)", () => {
    const wed = currentWeek(new Date(2026, 9, 21, 15));
    expect(wed.dates).toHaveLength(7);
    expect(wed.dates[0].toDateString()).toBe(new Date(2026, 9, 19).toDateString());
    expect(wed.dates[6].toDateString()).toBe(new Date(2026, 9, 25).toDateString());
    expect(wed.dayLabels[0]).toMatch(/^Mon/);

    const sun = currentWeek(new Date(2026, 9, 25, 9));
    expect(sun.dates[0].toDateString()).toBe(new Date(2026, 9, 19).toDateString());
  });

  it("buckets transactions by local day and ignores other days", () => {
    const { dates } = currentWeek(new Date(2026, 9, 21));
    const list = [
      tx("INCOME", "A", 100, { date: new Date(2026, 9, 19, 9).toISOString() }),
      tx("EXPENSE", "B", 40, { date: new Date(2026, 9, 19, 18).toISOString() }),
      tx("INCOME", "C", 10, { date: new Date(2026, 9, 25, 23).toISOString() }),
      tx("INCOME", "D", 500, { date: new Date(2026, 9, 12).toISOString() }),
    ];
    expect(dailyFlows(list, dates)).toEqual({
      income: [100, 0, 0, 0, 0, 0, 10],
      expense: [40, 0, 0, 0, 0, 0, 0],
      net: [60, 0, 0, 0, 0, 0, 10],
    });
  });

  it("indexOfMax picks the first maximum", () => {
    expect(indexOfMax([1, 5, 5, 0])).toBe(1);
    expect(indexOfMax([0, 0])).toBe(0);
  });
});

describe("buildNetTrend", () => {
  it("draws a flat line at the top for an all-zero week", () => {
    const t = buildNetTrend([0, 0, 0, 0, 0, 0, 0]);
    expect(t.zeroY).toBe(20);
    expect(t.linePath).toBe("M 20.0 20.0 L 60.0 20.0 L 100.0 20.0 L 140.0 20.0 L 180.0 20.0 L 220.0 20.0 L 260.0 20.0");
    expect(t.areaPath).toBe(`${t.linePath} L 260.0 20.0 L 20.0 20.0 Z`);
  });

  it("scales between min (<= 0) and max (>= 0)", () => {
    const t = buildNetTrend([100, -100, 0, 0, 0, 0, 0]);
    expect(t.min).toBe(-100);
    expect(t.max).toBe(100);
    expect(t.points[0]).toEqual({ x: 20, y: 20, value: 100 });
    expect(t.points[1]).toEqual({ x: 60, y: 85, value: -100 });
    expect(t.zeroY).toBe(52.5);
  });

  it("falls back to seven zero days for an empty input", () => {
    expect(buildNetTrend([]).values).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });
});

describe("quick add categories", () => {
  it("reads category options from the layout's fld_tx_category field (last match wins)", () => {
    const schema = {
      sections: [
        { fields: [{ id: "fld_tx_category", options: ["A"] }, { id: "other", options: ["x"] }] },
        { fields: [{ id: "fld_tx_category", options: ["Xerox", "Fuel"] }] },
      ],
    };
    expect(layoutCategoryOptions(schema)).toEqual(["Xerox", "Fuel"]);
    expect(layoutCategoryOptions(undefined)).toEqual([]);
  });

  it("classifies income categories and falls back to the built-in list", () => {
    expect(buildQuickAddCategories(["Xerox", "Fuel"])).toEqual([
      { label: "Xerox", icon: "ph-printer", color: getConsistentColorClasses("Xerox").text, bg: getConsistentColorClasses("Xerox").bg, type: "INCOME" },
      { label: "Fuel", icon: "ph-gas-pump", color: "text-red-600", bg: "bg-red-50", type: "EXPENSE" },
    ]);
    expect(buildQuickAddCategories([]).map((c) => c.label)).toEqual(Object.keys(CATEGORY_ICONS));
  });
});
