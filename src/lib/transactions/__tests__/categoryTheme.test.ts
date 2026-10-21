import { describe, expect, it } from "vitest";
import {
  categoryColorName,
  getCategoryColorClasses,
  getCategoryIcon,
  getConsistentColorClasses,
  getRelatableIcon,
} from "../categoryTheme";

describe("getRelatableIcon", () => {
  it("maps keywords to icons in priority order", () => {
    expect(getRelatableIcon("Passport Photo")).toBe("ph-identification-card");
    expect(getRelatableIcon("PP")).toBe("ph-identification-card");
    expect(getRelatableIcon("Xerox")).toBe("ph-printer");
    expect(getRelatableIcon("Design Charges")).toBe("ph-paint-brush");
    expect(getRelatableIcon("Lamination")).toBe("ph-book-open");
    expect(getRelatableIcon("Ink")).toBe("ph-palette");
    expect(getRelatableIcon("Bus fare")).toBe("ph-bus");
    expect(getRelatableIcon("Salary")).toBe("ph-money");
    expect(getRelatableIcon("Tea & snacks")).toBe("ph-coffee");
    expect(getRelatableIcon("Chit fund")).toBe("ph-piggy-bank");
    expect(getRelatableIcon("E-Sevai")).toBe("ph-desktop");
    expect(getRelatableIcon("Courier")).toBe("ph-package");
    expect(getRelatableIcon("Frame Sales")).toBe("ph-frame-corners");
    expect(getRelatableIcon("Others")).toBe("ph-dots-three-circle");
    expect(getRelatableIcon("Zzz")).toBe("ph-tag");
  });

  it("only matches 'ink' as a whole word", () => {
    expect(getRelatableIcon("Drinking water")).toBe("ph-tag");
  });

  it("checks earlier rules first ('print' beats 'paper')", () => {
    expect(getRelatableIcon("Printing paper")).toBe("ph-printer");
  });
});

describe("getConsistentColorClasses", () => {
  it("is stable per category name and never hashes to slate", () => {
    expect(getConsistentColorClasses("Xerox")).toEqual({ bg: "bg-red-50", text: "text-red-600", stroke: "#f87171" });
    expect(getConsistentColorClasses("Salary")).toEqual({ bg: "bg-purple-50", text: "text-purple-600", stroke: "#c084fc" });
    expect(getConsistentColorClasses("")).toEqual({ bg: "bg-emerald-50", text: "text-emerald-600", stroke: "#34d399" });
    for (const cat of ["Rent", "Fuel", "Printout", "Some long custom category"]) {
      expect(getConsistentColorClasses(cat).text).not.toBe("text-slate-600");
    }
  });

  it("uses a known predefined colour name and ignores unknown ones", () => {
    expect(getConsistentColorClasses("Anything", "slate").text).toBe("text-slate-600");
    expect(getConsistentColorClasses("Xerox", "nope")).toEqual(getConsistentColorClasses("Xerox"));
  });
});

describe("category helpers", () => {
  it("derives the palette name from the predefined colour", () => {
    expect(categoryColorName("Rent")).toBe("slate");
    expect(categoryColorName("Printing Job")).toBe("emerald");
    expect(categoryColorName("Unknown")).toBeUndefined();
  });

  it("honours predefined colours, falling back to the hash", () => {
    expect(getCategoryColorClasses("Printing Job").text).toBe("text-emerald-600");
    expect(getCategoryColorClasses("Rent").text).toBe("text-slate-600");
    expect(getCategoryColorClasses("Xerox")).toEqual(getConsistentColorClasses("Xerox"));
  });

  it("prefers the explicit icon map over keywords", () => {
    expect(getCategoryIcon("Passport Photo")).toBe("ph-user");
    expect(getCategoryIcon("Xerox")).toBe("ph-printer");
  });
});
