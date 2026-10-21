import { describe, expect, it } from "vitest";
import {
  EMPTY_FILTER_DRAFT,
  applyDraftToQuery,
  buildListQuery,
  clearedQuery,
  dayQuery,
  draftFromFilters,
  hasActiveFilterBadges,
  hasAdvancedFilters,
  hasEmptyStateFilters,
  monthQuery,
  readTransactionFilters,
  viewQuery,
  weekQuery,
  weekRangeFromDate,
} from "../filters";

const read = (q: string) => readTransactionFilters(new URLSearchParams(q));

describe("reading filters", () => {
  it("reads every known param, null when absent", () => {
    expect(read("view=week&type=INCOME&categories=Rent")).toEqual({
      view: "week", dateFrom: null, dateTo: null, categories: "Rent", amountMin: null, amountMax: null,
      type: "INCOME", paymentMode: null, month: null,
    });
  });

  it("derives the flag helpers", () => {
    expect(hasAdvancedFilters(read("view=day"))).toBe(false);
    expect(hasAdvancedFilters(read("amountMin=5"))).toBe(true);
    expect(hasAdvancedFilters(read("dateFrom=2026-01-01"))).toBe(false);
    expect(hasActiveFilterBadges(read("type=ALL&paymentMode=ALL"))).toBe(false);
    expect(hasActiveFilterBadges(read("dateTo=2026-01-01"))).toBe(true);
    // The empty-state check ignores amounts and treats "ALL" as set (as before).
    expect(hasEmptyStateFilters(read("amountMin=5"))).toBe(false);
    expect(hasEmptyStateFilters(read("type=ALL"))).toBe(true);
  });

  it("turns URL filters into a dialog draft", () => {
    expect(draftFromFilters(read(""))).toEqual(EMPTY_FILTER_DRAFT);
    expect(draftFromFilters(read("type=EXPENSE&amountMax=9"))).toEqual({ ...EMPTY_FILTER_DRAFT, type: "EXPENSE", amountMax: "9" });
  });
});

describe("query builders", () => {
  it("applies a draft, trimming categories and dropping ALL", () => {
    const next = applyDraftToQuery("view=week&amountMin=1&type=INCOME", {
      ...EMPTY_FILTER_DRAFT,
      categories: " Rent, Fuel ",
      paymentMode: "UPI",
    });
    expect(next).toBe("view=week&categories=Rent%2C+Fuel&paymentMode=UPI");
  });

  it("a custom date range replaces the preset view and month", () => {
    expect(applyDraftToQuery("view=month&month=2026-09", { ...EMPTY_FILTER_DRAFT, dateFrom: "2026-10-01" })).toBe("dateFrom=2026-10-01");
  });

  it("clear keeps only the view", () => {
    expect(clearedQuery("day")).toBe("view=day");
    expect(clearedQuery(null)).toBe("");
  });

  it("switching view drops dates and month but keeps other filters", () => {
    expect(viewQuery("type=INCOME&dateFrom=a&dateTo=b&month=c&view=day", "week")).toBe("type=INCOME&view=week");
  });

  it("picks a day", () => {
    expect(dayQuery("type=INCOME", "2026-10-21")).toBe("type=INCOME&view=day&dateFrom=2026-10-21&dateTo=2026-10-21");
  });

  it("picks the Sunday..Saturday week of a date", () => {
    expect(weekRangeFromDate("2026-10-21T12:00:00")).toEqual({ start: "2026-10-18", end: "2026-10-24" });
    expect(weekRangeFromDate("2026-11-01T12:00:00")).toEqual({ start: "2026-11-01", end: "2026-11-07" });
    expect(weekQuery("", "2026-10-21T12:00:00")).toBe("view=week&dateFrom=2026-10-18&dateTo=2026-10-24");
  });

  it("picks a month and drops the date range", () => {
    expect(monthQuery("dateFrom=a&dateTo=b", "2026-03-15T12:00:00")).toBe("view=month&month=2026-03");
  });
});

describe("buildListQuery", () => {
  it("sends the view and month only without a custom range", () => {
    expect(buildListQuery(read("view=month&month=2026-09&type=EXPENSE"), 1)).toBe("view=month&type=EXPENSE&month=2026-09");
    expect(buildListQuery(read("view=month&month=2026-09&dateFrom=2026-10-01"), 1)).toBe("dateFrom=2026-10-01");
  });

  it("ignores month for non-month views and adds the page after the first", () => {
    expect(buildListQuery(read("view=week&month=2026-09"), 3)).toBe("view=week&page=3");
    expect(buildListQuery(read(""), 1)).toBe("");
  });

  it("keeps the API's param order", () => {
    expect(
      buildListQuery(read("paymentMode=UPI&type=INCOME&amountMax=9&amountMin=1&categories=Rent&dateTo=b&dateFrom=a"), 2)
    ).toBe("dateFrom=a&dateTo=b&categories=Rent&amountMin=1&amountMax=9&type=INCOME&paymentMode=UPI&page=2");
  });
});
