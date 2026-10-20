import { describe, expect, it } from "vitest";
import { businessDayRange, businessMonthRange, businessRangeFromISO, calendarDateToUtc, toBusinessISODate } from "../dates";

describe("business timezone dates (Asia/Kolkata, UTC+5:30)", () => {
  it("treats 00:30 IST as the new day even though it is the previous day in UTC", () => {
    const halfPastMidnightIST = new Date("2026-10-19T19:00:00Z"); // 2026-10-20 00:30 IST
    expect(toBusinessISODate(halfPastMidnightIST)).toBe("2026-10-20");
  });

  it("day range spans IST midnight to midnight", () => {
    const { start, end } = businessDayRange(new Date("2026-10-20T06:00:00Z"));
    expect(start.toISOString()).toBe("2026-10-19T18:30:00.000Z");
    expect(end.toISOString()).toBe("2026-10-20T18:29:59.999Z");
  });

  it("month range starts on the 1st at IST midnight", () => {
    const { start, end } = businessMonthRange(new Date("2026-02-10T00:00:00Z"));
    expect(start.toISOString()).toBe("2026-01-31T18:30:00.000Z");
    expect(end.toISOString()).toBe("2026-02-28T18:29:59.999Z");
  });

  it("filter range from yyyy-MM-dd strings is inclusive in IST", () => {
    const r = businessRangeFromISO("2026-10-01", "2026-10-31");
    expect(r.start?.toISOString()).toBe("2026-09-30T18:30:00.000Z");
    expect(r.end?.toISOString()).toBe("2026-10-31T18:29:59.999Z");
  });

  it("calendar dates are stored as UTC midnight", () => {
    expect(calendarDateToUtc("2026-10-20").toISOString()).toBe("2026-10-20T00:00:00.000Z");
  });
});
