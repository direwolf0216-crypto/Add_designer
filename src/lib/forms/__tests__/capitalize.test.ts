import { describe, expect, it } from "vitest";
import { capitalizeFirst, capitalizesFirst } from "../capitalize";

describe("capitalizeFirst", () => {
  it("upper-cases only the first letter", () => {
    expect(capitalizeFirst("tenkasi")).toBe("Tenkasi");
    expect(capitalizeFirst("mela bazar, ayikudi")).toBe("Mela bazar, ayikudi");
    expect(capitalizeFirst("nEI store")).toBe("NEI store");
    expect(capitalizeFirst("a")).toBe("A");
  });

  it("skips leading spaces, digits and symbols, and leaves text without letters alone", () => {
    expect(capitalizeFirst("  shop")).toBe("  Shop");
    expect(capitalizeFirst("12, main road")).toBe("12, Main road");
    expect(capitalizeFirst("#3 cross")).toBe("#3 Cross");
    expect(capitalizeFirst("1234")).toBe("1234");
    expect(capitalizeFirst("")).toBe("");
  });

  it("returns the same text when it already starts with a capital (or a letter without case)", () => {
    expect(capitalizeFirst("Chennai")).toBe("Chennai");
    expect(capitalizeFirst("தென்காசி")).toBe("தென்காசி");
  });
});

describe("capitalizesFirst", () => {
  it("applies to single-line and multi-line text by default, and nothing else", () => {
    expect(capitalizesFirst({ type: "SINGLE_LINE" })).toBe(true);
    expect(capitalizesFirst({ type: "MULTI_LINE" })).toBe(true);
    for (const type of ["EMAIL", "PHONE", "NUMBER", "URL", "CURRENCY", "SIZE", "PICK_LIST"]) expect(capitalizesFirst({ type })).toBe(false);
    expect(capitalizesFirst({ type: "SINGLE_LINE", capitalize: false })).toBe(false);
  });
});
