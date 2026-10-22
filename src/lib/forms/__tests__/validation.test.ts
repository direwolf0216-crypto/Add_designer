import { describe, expect, it } from "vitest";
import { validateFieldValue } from "../validation";

describe("field validation", () => {
  it("checks numeric bounds and text length", () => {
    expect(validateFieldValue({ name: "Qty", type: "NUMBER", validation: { min: 1, max: 100 } }, "0")).toMatch(/at least 1/);
    expect(validateFieldValue({ name: "Qty", type: "NUMBER", validation: { min: 1, max: 100 } }, "50")).toBeNull();
    expect(validateFieldValue({ name: "Code", type: "SINGLE_LINE", validation: { minLength: 3 } }, "ab")).toMatch(/at least 3/);
    expect(validateFieldValue({ name: "Code", type: "SINGLE_LINE", validation: { maxLength: 3 } }, "abcd")).toMatch(/at most 3/);
  });

  it("checks well-known formats, custom regexes and custom messages", () => {
    expect(validateFieldValue({ name: "Phone", type: "PHONE", validation: { pattern: "phone" } }, "98765 43210".replace(" ", ""))).toBeNull();
    expect(validateFieldValue({ name: "Phone", type: "PHONE", validation: { pattern: "phone" } }, "12345")).toMatch(/10-digit/);
    expect(validateFieldValue({ name: "PIN", type: "SINGLE_LINE", validation: { pattern: "pincode" } }, "600001")).toBeNull();
    expect(validateFieldValue({ name: "GST", type: "SINGLE_LINE", validation: { pattern: "gstin" } }, "33ABCDE1234F1Z5")).toBeNull();
    expect(validateFieldValue({ name: "Ref", type: "SINGLE_LINE", validation: { pattern: "custom", regex: "^INV-\\d+$", message: "Use INV-123" } }, "x")).toBe("Use INV-123");
    expect(validateFieldValue({ name: "Ref", type: "SINGLE_LINE", validation: { pattern: "custom", regex: "(" } }, "x")).toBeNull();
  });

  it("lets blank values through (required is checked separately)", () => {
    expect(validateFieldValue({ name: "Qty", type: "NUMBER", validation: { min: 1 } }, "")).toBeNull();
  });
});
