import { describe, expect, it } from "vitest";
import { areaIn, areaUnitForSizeUnit, defaultRateUpdates, isPricingUnit, lineItemTotal, lineMultiplier, parseAreaSqFt, pricingUnitLabel, pricingUnitOptions, ruleSizeUnit } from "../pricing";
import { pricingRulesSchema } from "../pricingSchema";

describe("area pricing units", () => {
  it("maps Size-field units to the area they measure", () => {
    expect(areaUnitForSizeUnit("ft")).toBe("sqft");
    expect(areaUnitForSizeUnit("Feet")).toBe("sqft");
    expect(areaUnitForSizeUnit("sqft")).toBe("sqft");
    expect(areaUnitForSizeUnit("sq ft")).toBe("sqft");
    expect(areaUnitForSizeUnit("in")).toBe("sqin");
    expect(areaUnitForSizeUnit("Inch")).toBe("sqin");
    expect(areaUnitForSizeUnit("cm")).toBe("sqcm");
    expect(areaUnitForSizeUnit("mm")).toBe("sqmm");
    expect(areaUnitForSizeUnit("m")).toBe("sqm");
    expect(areaUnitForSizeUnit("sqm")).toBe("sqm");
    expect(areaUnitForSizeUnit("yd")).toBe("sqyd");
    expect(areaUnitForSizeUnit("pcs")).toBeNull();
  });

  it("measures a size in the rule's unit, whatever unit it was typed in", () => {
    expect(areaIn("3.5 x 2 in", "sqin")).toBe(7);
    expect(areaIn("1 x 1 ft", "sqin")).toBe(144);
    expect(areaIn("120 x 60 cm", "sqcm")).toBe(7200);
    expect(areaIn("2 x 3 m", "sqm")).toBe(6);
    expect(areaIn("10 x 6", "sqft")).toBe(60);
    expect(areaIn("10 x 6 pcs", "sqin")).toBeNull();
  });

  it("keeps sq ft pricing exactly as before", () => {
    for (const size of ["10 x 6", "3.5 x 2 in", "120 x 60 cm", "2.5 sqm", "4*6 ft"]) expect(areaIn(size, "sqft")).toBe(parseAreaSqFt(size));
    expect(lineItemTotal("25", "2", "sqft", "10 x 6")).toBe(3000);
    expect(lineItemTotal("25", "2", "piece", "10 x 6")).toBe(50);
  });

  it("prices per square inch and falls back to qty when the size can't be read", () => {
    expect(lineItemTotal("2", "3", "sqin", "3.5 x 2 in")).toBe(42);
    expect(lineMultiplier("sqin", "3", "A4")).toEqual({ multiplier: 3, area: null });
  });

  it("labels and validates units", () => {
    expect(pricingUnitLabel("sqin")).toBe("in²");
    expect(pricingUnitLabel("sqft")).toBe("ft²");
    expect(pricingUnitLabel("sqm")).toBe("m²");
    expect(pricingUnitLabel("piece")).toBe("piece");
    expect(isPricingUnit("sqcm")).toBe(true);
    expect(isPricingUnit("sqkm")).toBe(false);
  });
});

describe("pricingUnitOptions", () => {
  it("offers one area unit per Size-field unit, merging units that measure the same area", () => {
    const layout = { sections: [{ fields: [{ id: "s", name: "Size", type: "SIZE", sizeUnits: ["ft", "in", "sqft", "pcs"] }] }] };
    expect(pricingUnitOptions(layout)).toEqual({
      areas: [
        { unit: "sqft", from: ["ft", "sqft"] },
        { unit: "sqin", from: ["in"] },
      ],
      unmeasurable: ["pcs"],
      hasSizeField: true,
      sizeUnits: ["ft", "in", "sqft", "pcs"],
      choices: [
        { sizeUnit: "ft", unit: "sqft" },
        { sizeUnit: "in", unit: "sqin" },
        { sizeUnit: "sqft", unit: "sqft" },
        { sizeUnit: "pcs", unit: "piece" },
      ],
    });
  });

  it("uses the default units for a Size field without its own list, and none without a Size field", () => {
    expect(pricingUnitOptions({ sections: [{ fields: [{ name: "Size", type: "SIZE" }] }] }).areas.map((a) => a.unit)).toEqual(["sqft", "sqin", "sqcm", "sqmm", "sqm"]);
    expect(pricingUnitOptions({ sections: [{ fields: [{ name: "Qty", type: "NUMBER" }] }] })).toEqual({ areas: [], unmeasurable: [], hasSizeField: false, sizeUnits: [], choices: [] });
  });
});

describe("ruleSizeUnit: how a rule reads in Settings", () => {
  const options = pricingUnitOptions({ sections: [{ fields: [{ name: "Size", type: "SIZE", sizeUnits: ["Inch", "cm", "ft", "sqft", "pcs"] }] }] });

  it("shows the Size-field unit that was picked", () => {
    expect(ruleSizeUnit({ unit: "sqft", sizeUnit: "sqft" }, options)).toBe("sqft");
    expect(ruleSizeUnit({ unit: "sqft", sizeUnit: "ft" }, options)).toBe("ft");
    expect(ruleSizeUnit({ unit: "sqin", sizeUnit: "inch" }, options)).toBe("Inch");
    expect(ruleSizeUnit({ unit: "piece", sizeUnit: "pcs" }, options)).toBe("pcs");
  });

  it("falls back to the first Size-field unit for older rules saved without one", () => {
    expect(ruleSizeUnit({ unit: "sqft" }, options)).toBe("ft");
    expect(ruleSizeUnit({ unit: "sqcm", defaultRate: 2 }, options)).toBe("cm");
  });

  it("ignores a picked unit the Size field no longer offers or that disagrees with the rule", () => {
    expect(ruleSizeUnit({ unit: "sqft", sizeUnit: "yd" }, options)).toBe("ft");
    expect(ruleSizeUnit({ unit: "sqin", sizeUnit: "cm" }, options)).toBe("Inch");
    expect(ruleSizeUnit({ unit: "sqm" }, options)).toBeNull();
    expect(ruleSizeUnit({ unit: "piece" }, options)).toBeNull();
  });
});

describe("pricingRulesSchema: what the server accepts", () => {
  const ok = (value: unknown) => pricingRulesSchema.safeParse(value).success;

  it("accepts every pricing unit, with or without a rate and Size-field unit", () => {
    expect(ok({})).toBe(true);
    for (const unit of ["piece", "sqft", "sqin", "sqcm", "sqmm", "sqm", "sqyd"]) expect(ok({ Flex: { unit } })).toBe(true);
    expect(ok({ Flex: { unit: "sqft", defaultRate: 25, sizeUnit: "ft" } })).toBe(true);
    expect(ok({ Cards: { unit: "piece", defaultRate: 0.5, sizeUnit: "pcs" } })).toBe(true);
    expect(ok({ Flex: { unit: "sqft", defaultRate: 0 } })).toBe(true);
    expect(ok({ Flex: { unit: "sqft", defaultRate: 10_000_000 } })).toBe(true);
  });

  it.each([
    ["an unknown unit", { Flex: { unit: "sqkm" } }],
    ["the old spelling of a unit", { Flex: { unit: "sq ft" } }],
    ["a missing unit", { Flex: { defaultRate: 5 } }],
    ["a negative rate", { Flex: { unit: "sqft", defaultRate: -1 } }],
    ["a rate above ₹1 crore", { Flex: { unit: "sqft", defaultRate: 10_000_001 } }],
    ["a rate sent as text", { Flex: { unit: "sqft", defaultRate: "25" } }],
    ["NaN", { Flex: { unit: "sqft", defaultRate: NaN } }],
    ["Infinity", { Flex: { unit: "sqft", defaultRate: Infinity } }],
    ["an empty category name", { "  ": { unit: "piece" } }],
    ["a Size-field unit longer than the Size field allows", { Flex: { unit: "sqft", sizeUnit: "centimetres" } }],
    ["an empty Size-field unit", { Flex: { unit: "sqft", sizeUnit: " " } }],
    ["a list instead of a map", [{ unit: "piece" }]],
  ])("rejects %s", (_label, value) => expect(ok(value)).toBe(false));

  it("drops fields it doesn't know about rather than storing them", () => {
    expect(pricingRulesSchema.parse({ Flex: { unit: "sqft", defaultRate: 5, extra: "x" } })).toEqual({ Flex: { unit: "sqft", defaultRate: 5 } });
  });
});

describe("defaultRateUpdates: the job form's default rates", () => {
  const rules = { Flex: { unit: "sqft" as const, defaultRate: 25 }, Vinyl: { unit: "sqin" as const, defaultRate: 0.5 }, Plain: { unit: "piece" as const } };
  const row = (category: string, rateKey = "r0") => ({ rateKey, category });

  it("fills an empty box with the category's default", () => {
    expect(defaultRateUpdates([row("Flex")], {}, rules, {})).toEqual({ patch: { r0: "25" }, auto: { r0: { category: "Flex", value: "25" } } });
    expect(defaultRateUpdates([row("Plain")], {}, rules, {})).toEqual({ patch: {}, auto: {} });
  });

  it("moves a filled default to the new category's default when the category changes", () => {
    const auto = { r0: { category: "Flex", value: "25" } };
    expect(defaultRateUpdates([row("Vinyl")], { r0: "25" }, rules, auto)).toEqual({ patch: { r0: "0.5" }, auto: { r0: { category: "Vinyl", value: "0.5" } } });
  });

  it("empties a filled default when the new category has none, so the old category's price isn't billed", () => {
    expect(defaultRateUpdates([row("Plain")], { r0: "25" }, rules, { r0: { category: "Flex", value: "25" } })).toEqual({ patch: { r0: null }, auto: {} });
  });

  it("never touches a typed rate or one loaded from a saved job", () => {
    expect(defaultRateUpdates([row("Vinyl")], { r0: "30" }, rules, { r0: { category: "Flex", value: "25" } })).toEqual({ patch: {}, auto: {} });
    expect(defaultRateUpdates([row("Vinyl")], { r0: "25" }, rules, {})).toEqual({ patch: {}, auto: {} });
    expect(defaultRateUpdates([row("Vinyl")], { r0: "" }, rules, {})).toEqual({ patch: {}, auto: {} });
  });

  it("leaves a filled default alone while the category stays the same, in any case", () => {
    const auto = { r0: { category: "Flex", value: "25" } };
    expect(defaultRateUpdates([row("flex ")], { r0: "25" }, rules, auto)).toEqual({ patch: {}, auto });
  });

  it("handles every line on its own", () => {
    const out = defaultRateUpdates([row("Flex", "a"), row("Vinyl", "b"), row("Plain", "c")], { b: "9" }, rules, {});
    expect(out.patch).toEqual({ a: "25" });
  });
});
