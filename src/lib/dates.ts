// Business-timezone date helpers. The press operates in IST, but servers usually run in UTC and
// `toISOString()` is UTC, so "today" computed naively is wrong between 00:00 and 05:30 IST.
// Safe to import from client and server code.
import { TZDate } from "@date-fns/tz";
import { addDays, addMonths, format, startOfDay, startOfMonth, startOfWeek, endOfDay, endOfMonth } from "date-fns";

export const BUSINESS_TZ = "Asia/Kolkata";

const inTz = (date: Date | number) => new TZDate(typeof date === "number" ? date : date.getTime(), BUSINESS_TZ);

/** `yyyy-MM-dd` for a date as seen in the business timezone (default: now). */
export function toBusinessISODate(date: Date | number = new Date()): string {
  return format(inTz(date), "yyyy-MM-dd");
}

/** `yyyy-MM-dd` in the *browser's* local timezone — use for `<input type="date">` defaults. */
export function toLocalISODate(date: Date | number = new Date()): string {
  return format(date, "yyyy-MM-dd");
}

/** Parse `yyyy-MM-dd` as local midnight (unlike `new Date('yyyy-MM-dd')`, which is UTC midnight). */
export function parseLocalISODate(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/**
 * A calendar date (`yyyy-MM-dd`) stored as UTC midnight — how job dates are persisted.
 * Keeps the same calendar day regardless of server timezone.
 */
export function calendarDateToUtc(value: string): Date {
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1));
}

/**
 * The instant to record for a payment or ledger entry entered as a bare `yyyy-MM-dd`: right now when it is
 * today in the business timezone, otherwise noon of that day there. `new Date("yyyy-MM-dd")` would be UTC
 * midnight, which reads as 05:30 am in India and can land on the previous day elsewhere.
 */
export function recordInstantForDate(value: string | Date | null | undefined): Date {
  if (value instanceof Date) return value;
  if (!value) return new Date();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(value);
  if (value === toBusinessISODate()) return new Date();
  const [y, m, d] = value.split("-").map(Number);
  // 12:00 IST is 06:30 UTC.
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1, 6, 30));
}

/** UTC-midnight Date for "today" in the business timezone (to compare with stored job dates). */
export function businessTodayUtc(): Date {
  return calendarDateToUtc(toBusinessISODate());
}

type Range = { start: Date; end: Date };

/** Start/end instants of the business-timezone day containing `date`. */
export function businessDayRange(date: Date | number = new Date()): Range {
  const z = inTz(date);
  return { start: new Date(startOfDay(z).getTime()), end: new Date(endOfDay(z).getTime()) };
}

/** Start/end instants of the business-timezone month containing `date`. */
export function businessMonthRange(date: Date | number = new Date()): Range {
  const z = inTz(date);
  return { start: new Date(startOfMonth(z).getTime()), end: new Date(endOfMonth(z).getTime()) };
}

/** Monday-based week in the business timezone. */
export function businessWeekRange(date: Date | number = new Date()): Range {
  const z = inTz(date);
  const start = startOfWeek(z, { weekStartsOn: 1 });
  return { start: new Date(start.getTime()), end: new Date(endOfDay(addDays(start, 6)).getTime()) };
}

/** Business-timezone instant range for a `yyyy-MM-dd` .. `yyyy-MM-dd` filter (inclusive). */
export function businessRangeFromISO(from?: string | null, to?: string | null): Partial<Range> {
  const out: Partial<Range> = {};
  const tzDay = (iso: string) => {
    const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
    return new TZDate(y, (m || 1) - 1, d || 1, BUSINESS_TZ);
  };
  if (from) out.start = new Date(startOfDay(tzDay(from)).getTime());
  if (to) out.end = new Date(endOfDay(tzDay(to)).getTime());
  return out;
}

export { addDays, addMonths };
