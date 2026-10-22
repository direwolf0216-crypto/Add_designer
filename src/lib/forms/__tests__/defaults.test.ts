import { describe, expect, it } from "vitest";
import { resolveDefaultValue } from "../defaults";

describe("default values", () => {
  const ctx = { today: "2026-10-22", now: new Date(2026, 9, 22, 14, 5), userId: "u1" };
  it("resolves tokens and literals by type", () => {
    expect(resolveDefaultValue({ type: "DATE", defaultValue: "@today" }, ctx)).toBe("2026-10-22");
    expect(resolveDefaultValue({ type: "TIME", defaultValue: "@now" }, ctx)).toBe("02:05 PM");
    expect(resolveDefaultValue({ type: "USER_PICKLIST", defaultValue: "@me" }, ctx)).toBe("u1");
    expect(resolveDefaultValue({ type: "USER_PICKLIST", defaultValue: "@me" }, { ...ctx, userId: null })).toBeUndefined();
    expect(resolveDefaultValue({ type: "CHECKBOX", defaultValue: "true" }, ctx)).toBe(true);
    expect(resolveDefaultValue({ type: "MULTI_SELECT", defaultValue: "A, B" }, ctx)).toEqual(["A", "B"]);
    expect(resolveDefaultValue({ type: "SINGLE_LINE", defaultValue: "Chennai" }, ctx)).toBe("Chennai");
    expect(resolveDefaultValue({ type: "SINGLE_LINE" }, ctx)).toBeUndefined();
  });
});
