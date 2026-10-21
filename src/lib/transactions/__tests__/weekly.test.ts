import { describe, expect, it } from "vitest";
import { buildWeekSummary, mondayOf } from "../weekly";

// IST instants: 10:00 IST = 04:30 UTC
const ist = (iso: string, hh = "04:30") => new Date(`${iso}T${hh}:00Z`);

describe("weekly summary", () => {
  it("finds the IST Monday", () => {
    expect(mondayOf("2026-10-21")).toBe("2026-10-19"); // Wednesday
    expect(mondayOf("2026-10-25")).toBe("2026-10-19"); // Sunday
    expect(mondayOf("2026-10-19")).toBe("2026-10-19");
  });

  it("buckets by IST day, flags future days and totals last week", () => {
    const s = buildWeekSummary(
      [
        { amount: 100, type: "INCOME", date: ist("2026-10-19"), category: "Printing Job" },
        // 23:00 IST Monday is still Monday although it is 17:30 UTC
        { amount: 40, type: "EXPENSE", date: new Date("2026-10-19T17:30:00Z"), category: "Rent" },
        { amount: 60, type: "EXPENSE", date: ist("2026-10-21"), category: "Paper Purchase" },
        { amount: 500, type: "INCOME", date: ist("2026-10-14"), category: "Xerox" }, // last week
        { amount: 999, type: "INCOME", date: ist("2026-10-01"), category: "Xerox" }, // ignored
      ],
      "2026-10-21"
    );
    expect(s.days.map((d) => d.label)).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
    expect(s.days[0]).toMatchObject({ income: 100, expense: 40, net: 60, isToday: false, isFuture: false });
    expect(s.days[2]).toMatchObject({ expense: 60, isToday: true });
    expect(s.days[3].isFuture).toBe(true);
    expect(s.totals).toEqual({ income: 100, expense: 100, net: 0 });
    expect(s.previous).toEqual({ income: 500, expense: 0, net: 500 });
    expect(s.expensesByCategory).toEqual([
      { category: "Paper Purchase", amount: 60 },
      { category: "Rent", amount: 40 },
    ]);
  });
});
