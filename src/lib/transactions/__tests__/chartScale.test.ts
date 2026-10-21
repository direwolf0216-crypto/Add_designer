import { describe, expect, it } from "vitest";
import { niceCeil, niceTicks } from "../chartScale";

describe("chart scale", () => {
  it("rounds up to nice numbers", () => {
    expect(niceCeil(204674)).toBe(250000);
    expect(niceCeil(87614)).toBe(100000);
    expect(niceCeil(1)).toBe(1);
  });
  it("builds ticks including zero, largest first", () => {
    expect(niceTicks(0, 204674)).toEqual([250000, 200000, 150000, 100000, 50000, 0]);
    const withNegative = niceTicks(-5000, 87614);
    expect(withNegative[0]).toBeGreaterThanOrEqual(87614);
    expect(withNegative).toContain(0);
    expect(withNegative[withNegative.length - 1]).toBeLessThanOrEqual(-5000);
  });
});
