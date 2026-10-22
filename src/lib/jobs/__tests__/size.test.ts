import { describe, expect, it } from "vitest";
import { composeSize, splitSize } from "../size";
import { parseAreaSqFt } from "../pricing";

describe("size strings", () => {
  it("splits a size into dimensions and unit, defaulting to feet", () => {
    expect(splitSize("3 x 6")).toEqual({ dims: "3 x 6", unit: "ft" });
    expect(splitSize("120 x 60 cm")).toEqual({ dims: "120 x 60", unit: "cm" });
    expect(splitSize("4*6 ft")).toEqual({ dims: "4*6", unit: "ft" });
    expect(splitSize("2 x 3 meters")).toEqual({ dims: "2 x 3", unit: "m" });
    expect(splitSize("")).toEqual({ dims: "", unit: "ft" });
    expect(splitSize(undefined)).toEqual({ dims: "", unit: "ft" });
  });

  it("composes the stored string and keeps an empty size empty", () => {
    expect(composeSize("3 x 6", "cm")).toBe("3 x 6 cm");
    expect(composeSize("  ", "cm")).toBe("");
    expect(splitSize(composeSize("10 x 10", "in"))).toEqual({ dims: "10 x 10", unit: "in" });
  });

  it("prices every unit the picker offers", () => {
    expect(parseAreaSqFt(composeSize("3 x 6", "ft"))).toBe(18);
    expect(parseAreaSqFt(composeSize("12 x 12", "in"))).toBe(1);
    expect(parseAreaSqFt(composeSize("1 x 1", "m"))).toBe(10.764);
    expect(parseAreaSqFt(composeSize("100 x 100", "cm"))).toBe(10.764);
    expect(parseAreaSqFt(composeSize("1000 x 1000", "mm"))).toBe(10.764);
  });
});
