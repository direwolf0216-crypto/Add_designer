import { describe, expect, it } from "vitest";
import { composeSize, defaultUnitFor, isSizeLayoutField, looksLikeSize, splitSize, unitsFor } from "../size";
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

  it("uses the layout field's own units and preselected unit", () => {
    const field = { sizeUnits: ["Inch", "cm", "pcs"], defaultUnit: "cm" };
    expect(unitsFor(field)).toEqual(["Inch", "cm", "pcs"]);
    expect(defaultUnitFor(field)).toBe("cm");
    expect(splitSize("3 x 6", field)).toEqual({ dims: "3 x 6", unit: "cm" });
    expect(splitSize("3 x 6 inch", field)).toEqual({ dims: "3 x 6", unit: "Inch" });
    expect(splitSize("2 x 2 pcs", field)).toEqual({ dims: "2 x 2", unit: "pcs" });
    expect(defaultUnitFor({ sizeUnits: ["mm", "m"] })).toBe("mm");
    expect(defaultUnitFor({ sizeUnits: [" ", ""] })).toBe("ft");
  });

  it("prices every convertible unit and leaves custom units per piece", () => {
    expect(parseAreaSqFt(composeSize("3 x 6", "ft"))).toBe(18);
    expect(parseAreaSqFt(composeSize("12 x 12", "in"))).toBe(1);
    expect(parseAreaSqFt(composeSize("1 x 1", "m"))).toBe(10.764);
    expect(parseAreaSqFt(composeSize("100 x 100", "cm"))).toBe(10.764);
    expect(parseAreaSqFt(composeSize("1000 x 1000", "mm"))).toBe(10.764);
    expect(parseAreaSqFt(composeSize("1 x 1", "yd"))).toBe(9);
    expect(parseAreaSqFt(composeSize("2 x 2", "pcs"))).toBeNull();
  });
});

describe("finding sizes in saved data", () => {
  it("recognises Size fields by type or by an older text field's name", () => {
    expect(isSizeLayoutField({ type: "SIZE", name: "Dimensions" })).toBe(true);
    expect(isSizeLayoutField({ type: "SINGLE_LINE", name: "Size" })).toBe(true);
    expect(isSizeLayoutField({ type: "SINGLE_LINE", name: "Notes" })).toBe(false);
    expect(looksLikeSize("3 x 6")).toBe(true);
    expect(looksLikeSize("120×60 cm")).toBe(true);
    expect(looksLikeSize("Flex Printing")).toBe(false);
    expect(looksLikeSize("12")).toBe(false);
  });
});
