import { describe, expect, it } from "vitest";
import { displayText, isBlankValue } from "../blank";

describe("isBlankValue", () => {
  it("treats placeholders, empties and zero as blank", () => {
    for (const v of [null, undefined, "", "  ", "N/A", "n/a", "NA", "nil", "Nil", "-", "—", "none", 0, "0", "0.00", "₹ 0", "₹0", "Rs 0.00", "INR 0", [], ["", "N/A"], Number.NaN]) {
      expect(isBlankValue(v), JSON.stringify(v)).toBe(true);
    }
  });

  it("keeps real values, including ones that merely contain a zero", () => {
    for (const v of ["Tenkasi", "0091 98765", "10 x 6", "₹ 100", "Rs 0.50", "100", 5, -3, false, true, ["a"], "nail"]) {
      expect(isBlankValue(v), JSON.stringify(v)).toBe(false);
    }
  });
});

describe("displayText", () => {
  it("formats what's worth showing and drops the rest", () => {
    expect(displayText("  Tenkasi ")).toBe("Tenkasi");
    expect(displayText(125000)).toBe("1,25,000");
    expect(displayText(true)).toBe("Yes");
    expect(displayText(["Lamination", "", "N/A", "Binding"])).toBe("Lamination, Binding");
    expect(displayText({ a: 1 })).toBeNull();
    expect(displayText("N/A")).toBeNull();
    expect(displayText(0)).toBeNull();
  });
});
