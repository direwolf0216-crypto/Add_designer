// Money-critical: exhaustive checks of area pricing. The sq ft parser is compared bit-for-bit with the
// implementation every saved job was priced with, and every other unit with an independent calculation.
import { describe, expect, it } from "vitest";
import { AREA_PRICING_UNITS, areaIn, areaUnitForSizeUnit, isAreaPricing, lineItemTotal, lineMultiplier, parseAreaSqFt, type AreaPricingUnit } from "../pricing";

/** The sq ft parser before area units existed (commit 2a3b85e), kept verbatim as the reference. */
function legacyParseAreaSqFt(size: unknown): number | null {
  const SQFT_PER: Record<string, number> = { ft: 1, feet: 1, foot: 1, "'": 1, in: 1 / 144, inch: 1 / 144, inches: 1 / 144, '"': 1 / 144, cm: 1 / 929.0304, mm: 1 / 92903.04, m: 10.7639, mtr: 10.7639, meter: 10.7639, metre: 10.7639, yd: 9, yard: 9, yards: 9, sqft: 1, sqm: 10.7639 };
  const SQFT_PER_AREA: Record<string, number> = { sqft: 1, sqf: 1, "ft²": 1, sqm: 10.7639, "m²": 10.7639 };
  if (size === null || size === undefined) return null;
  const text = String(size).trim().toLowerCase().replace(/×/g, "x").replace(/sq\.?\s*(ft|m)\b/g, "sq$1");
  const area1 = text.match(/^(\d+(?:\.\d+)?)\s*(sqft|sqf|ft²|sqm|m²)$/);
  if (area1) {
    const a = parseFloat(area1[1]) * SQFT_PER_AREA[area1[2]];
    return Number.isFinite(a) && a > 0 ? Math.round(a * 1000) / 1000 : null;
  }
  const m = text.match(/^(\d+(?:\.\d+)?)\s*([a-z'"]+)?\s*[x*]\s*(\d+(?:\.\d+)?)\s*([a-z'"]+)?\s*(?:sq\.?\s*ft)?$/);
  if (!m) return null;
  const unit = m[4] || m[2] || "ft";
  const factor = SQFT_PER[unit];
  if (!factor) return null;
  const area = parseFloat(m[1]) * parseFloat(m[3]) * factor;
  return Number.isFinite(area) && area > 0 ? Math.round(area * 1000) / 1000 : null;
}

/** Deterministic PRNG so every run checks the same thousands of cases. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = <T,>(r: () => number, xs: readonly T[]) => xs[Math.floor(r() * xs.length)];

const NUMBERS = ["0", "1", "2", "3.5", "10", "12", "0.5", "0.001", "120", "60", "4.25", "1000", "99999", "007", "1.", ".5", "-3", "1e3", "2,5"];
const UNITS = ["", "ft", "Ft", "FT", "feet", "foot", "'", "in", "IN", "inch", "inches", '"', "cm", "mm", "m", "mtr", "meter", "metre", "yd", "yard", "yards", "sqft", "sqm", "pcs", "sheets", "constructor", "toString", "__proto__", "hasOwnProperty"];
const SEPARATORS = [" x ", "x", " X ", "×", " × ", " * ", "*", "  x  ", " by "];

function randomSize(r: () => number): unknown {
  const shape = r();
  if (shape < 0.08) return pick(r, [null, undefined, "", "   ", "A4", "10", "x", "10 x", "x 6", "10 x 6 x 2", "ten x six", 42, 0, true, {}, [], "∞ x 2", "NaN x 2"]);
  if (shape < 0.22) return `${pick(r, NUMBERS)}${pick(r, ["", " "])}${pick(r, ["sqft", "sq ft", "sq.ft", "sqf", "ft²", "sqm", "sq m", "sq.m", "m²", "SQFT", "sq  ft"])}`;
  const a = pick(r, NUMBERS);
  const b = pick(r, NUMBERS);
  const u1 = r() < 0.3 ? pick(r, UNITS) : "";
  const u2 = r() < 0.7 ? pick(r, UNITS) : "";
  const pad = () => (r() < 0.3 ? " " : "");
  const tail = r() < 0.05 ? " sq ft" : "";
  return `${pad()}${a}${u1 ? `${pick(r, ["", " "])}${u1}` : ""}${pick(r, SEPARATORS)}${b}${u2 ? `${pick(r, ["", " "])}${u2}` : ""}${tail}${pad()}`;
}

const UNIT_KEYS = Object.keys(AREA_PRICING_UNITS) as AreaPricingUnit[];

describe("sq ft area: identical to the parser saved jobs were priced with", () => {
  it("matches the legacy parser exactly on 20,000 generated sizes", () => {
    const r = rng(20261023);
    const mismatches: string[] = [];
    for (let i = 0; i < 20_000; i++) {
      const size = randomSize(r);
      const before = legacyParseAreaSqFt(size);
      if (parseAreaSqFt(size) !== before || areaIn(size, "sqft") !== before) mismatches.push(JSON.stringify(size));
    }
    expect(mismatches).toEqual([]);
  });

  it("matches the legacy parser on hand-picked sizes", () => {
    const cases: [unknown, number | null][] = [
      ["10 x 6", 60], ["10x6", 60], ["10 X 6", 60], ["10 × 6", 60], ["4*6 ft", 24], ["4ft x 6", 24], ["3.5 x 2 in", 0.049], ["120 x 60 cm", 7.75],
      ["2 x 3 m", 64.583], ["1 x 1 yd", 9], ["10 sqft", 10], ["10 sq ft", 10], ["2.5 sqm", 26.91], ["60 sq.ft", 60], ["10 x 6 pcs", null],
      ["A4", null], ["", null], [null, null], [undefined, null], ["0 x 6", null], ["10 x 6 constructor", null], ["10 x 6 toString", null],
    ];
    for (const [size, expected] of cases) {
      expect(legacyParseAreaSqFt(size)).toBe(expected);
      expect(parseAreaSqFt(size)).toBe(expected);
    }
  });
});

describe("other area units convert exactly", () => {
  // Exact square feet per square unit, written independently of the code under test.
  const SQFT_PER_SQ: Record<AreaPricingUnit, number> = { sqft: 1, sqin: 1 / 144, sqcm: 1 / 929.0304, sqmm: 1 / 92903.04, sqm: 1 / 0.09290304, sqyd: 9 };
  const LENGTH: Record<string, AreaPricingUnit> = { ft: "sqft", in: "sqin", cm: "sqcm", mm: "sqmm", m: "sqm", yd: "sqyd" };

  it("agrees with an independent conversion for every typed unit × priced unit on 5,000 random sizes", () => {
    const r = rng(7);
    for (let i = 0; i < 5_000; i++) {
      const w = Math.round(r() * 50000) / 100 + 0.01;
      const h = Math.round(r() * 50000) / 100 + 0.01;
      const typed = pick(r, Object.keys(LENGTH));
      const size = `${w} x ${h} ${typed}`;
      for (const target of UNIT_KEYS.filter((u) => u !== "sqft")) {
        const exact = (w * h * SQFT_PER_SQ[LENGTH[typed]]) / SQFT_PER_SQ[target];
        const got = areaIn(size, target);
        if (Math.round(exact * 1000) / 1000 === 0) expect(got).toBeNull();
        else expect(Math.abs((got as number) - exact)).toBeLessThanOrEqual(0.0005 + exact * 1e-12);
      }
    }
  });

  it("is exact when the size is typed in the priced unit", () => {
    expect(areaIn("3.5 x 2 in", "sqin")).toBe(7);
    expect(areaIn("120 x 60 cm", "sqcm")).toBe(7200);
    expect(areaIn("297 x 210 mm", "sqmm")).toBe(62370);
    expect(areaIn("2 x 3 m", "sqm")).toBe(6);
    expect(areaIn("2.5 sqm", "sqm")).toBe(2.5);
    expect(areaIn("3 x 4 yd", "sqyd")).toBe(12);
  });

  it("converts between units like a tape measure would", () => {
    expect(areaIn("1 x 1 ft", "sqin")).toBe(144);
    expect(areaIn("1 x 1 m", "sqcm")).toBe(10000);
    expect(areaIn("1 x 1 cm", "sqmm")).toBe(100);
    expect(areaIn("1 x 1 yd", "sqin")).toBe(1296);
    expect(areaIn("10 x 10 cm", "sqin")).toBe(15.5);
    expect(areaIn("10 sqft", "sqin")).toBe(1440);
    expect(areaIn("1 x 1 in", "sqm")).toBe(0.001);
  });

  it("returns null for unreadable sizes and areas too small to bill", () => {
    for (const u of UNIT_KEYS) {
      expect(areaIn("A4", u)).toBeNull();
      expect(areaIn("10 x 6 pcs", u)).toBeNull();
      expect(areaIn("10 x 6 __proto__", u)).toBeNull();
      expect(areaIn("0 x 6", u)).toBeNull();
      expect(areaIn(null, u)).toBeNull();
    }
    expect(areaIn("1 x 1 mm", "sqm")).toBeNull();
  });
});

describe("size units map to the area they measure", () => {
  it.each([
    ["ft", "sqft"], ["Feet", "sqft"], ["foot", "sqft"], ["sqft", "sqft"], ["sq ft", "sqft"], ["sq.ft", "sqft"], ["ft²", "sqft"],
    ["in", "sqin"], ["Inch", "sqin"], ["inches", "sqin"], ["cm", "sqcm"], ["mm", "sqmm"], ["m", "sqm"], ["mtr", "sqm"], ["metre", "sqm"],
    ["sqm", "sqm"], ["sq m", "sqm"], ["yd", "sqyd"], ["yards", "sqyd"],
  ])("%s → %s", (unit, area) => expect(areaUnitForSizeUnit(unit)).toBe(area));

  it.each(["pcs", "sheets", "set", "", "  ", "constructor", "toString", "__proto__", "km", "sqkm"])("%j can't be measured", (unit) => expect(areaUnitForSizeUnit(unit)).toBeNull());
});

describe("line totals", () => {
  it("is rate × qty per piece, ignoring the size", () => {
    expect(lineItemTotal("250", "4", "piece", "10 x 6")).toBe(1000);
    expect(lineItemTotal("2.5", "3", "piece", "")).toBe(7.5);
  });

  it("is rate × area × qty for every area unit", () => {
    expect(lineItemTotal("25", "2", "sqft", "10 x 6")).toBe(3000);
    expect(lineItemTotal("2.5", "3", "sqin", "3.5 x 2 in")).toBe(52.5);
    expect(lineItemTotal("0.05", "10", "sqcm", "120 x 60 cm")).toBeCloseTo(3600, 10);
    expect(lineItemTotal("400", "1", "sqm", "2 x 3 m")).toBe(2400);
    expect(lineItemTotal("90", "2", "sqyd", "3 x 4 yd")).toBe(2160);
  });

  it("charges an unreadable size per piece instead of zero", () => {
    expect(lineMultiplier("sqin", "3", "A4")).toEqual({ multiplier: 3, area: null });
    expect(lineItemTotal("2", "3", "sqcm", "10 x 6 pcs")).toBe(6);
  });

  it("treats a missing rate as zero and a missing quantity as one", () => {
    expect(lineItemTotal(undefined, "3", "sqft", "10 x 6")).toBe(0);
    expect(lineItemTotal("", "3", "piece")).toBe(0);
    expect(lineItemTotal("abc", "3", "piece")).toBe(0);
    expect(lineItemTotal("10", "", "piece")).toBe(10);
    expect(lineItemTotal("10", "", "sqft", "2 x 3")).toBe(60);
  });

  it("scales linearly with rate and quantity (1,000 random lines)", () => {
    const r = rng(99);
    for (let i = 0; i < 1_000; i++) {
      const unit = pick(r, ["piece", ...UNIT_KEYS] as const);
      const size = `${Math.ceil(r() * 200)} x ${Math.ceil(r() * 200)} ${pick(r, ["ft", "in", "cm", "mm", "m"])}`;
      const rate = Math.round(r() * 100000) / 100;
      const qty = Math.ceil(r() * 500);
      const one = lineItemTotal(String(rate), "1", unit, size);
      // To the paisa, or to 1e-12 of the amount where a double can't hold paise (trillions).
      const near = (a: number, b: number) => expect(Math.abs(a - b)).toBeLessThanOrEqual(Math.max(0.005, Math.abs(b) * 1e-12));
      near(lineItemTotal(String(rate), String(qty), unit, size), one * qty);
      near(lineItemTotal(String(rate * 2), String(qty), unit, size), one * qty * 2);
      if (!isAreaPricing(unit)) expect(one).toBe(rate);
    }
  });
});
