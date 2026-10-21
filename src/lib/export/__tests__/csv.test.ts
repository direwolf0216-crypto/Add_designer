import { describe, expect, it } from "vitest";
import { escapeCsv, toCsv } from "../csv";

describe("escapeCsv", () => {
  it("quotes every value and doubles embedded quotes", () => {
    expect(escapeCsv("a,b")).toBe('"a,b"');
    expect(escapeCsv('say "x"')).toBe('"say ""x"""');
    expect(escapeCsv(0)).toBe('"0"');
    expect(escapeCsv(false)).toBe('"false"');
  });

  it("renders empty / nullish as an empty quoted cell and objects as JSON", () => {
    expect(escapeCsv("")).toBe('""');
    expect(escapeCsv(null)).toBe('""');
    expect(escapeCsv(undefined)).toBe('""');
    expect(escapeCsv({ a: "b" })).toBe('"{""a"":""b""}"');
  });
});

describe("toCsv", () => {
  it("joins cells with commas and rows with newlines; empty rows become blank lines", () => {
    expect(toCsv([["a", "b"], [], [1]])).toBe("a,b\n\n1");
  });
});
