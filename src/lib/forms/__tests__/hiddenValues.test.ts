import { describe, expect, it } from "vitest";
import { withoutHiddenValues } from "../visibility";

const map = { fld_cat: "category", fld_size: "fld_size", fld_lam: "fld_lam" };
const nameOf = (id: string) => (map as Record<string, string>)[id] ?? id;
const sizeOnlyForFlex = { id: "fld_size", visibilityRule: { conditions: [{ fieldId: "fld_cat", operator: "EQUALS", values: ["Flex Printing"] }] } };
// Lamination is only offered once a size is given.
const lamWhenSized = { id: "fld_lam", visibilityRule: { conditions: [{ fieldId: "fld_size", operator: "IS_NOT_EMPTY" }] } };
const fields = [{ id: "fld_cat" }, sizeOnlyForFlex, lamWhenSized, { id: "fld_qty" }];

describe("withoutHiddenValues", () => {
  it("drops a size typed for Flex once the category is Invitations", () => {
    const out = withoutHiddenValues({ category: "Invitations", fld_size: "3*5 Sqft", fld_qty: "2" }, fields, {}, map, nameOf);
    expect(out).toEqual({ category: "Invitations", fld_qty: "2" });
  });

  it("keeps values whose fields are still shown", () => {
    const entry = { category: "Flex Printing", fld_size: "10 x 6", fld_lam: "Matte", fld_qty: "1" };
    expect(withoutHiddenValues(entry, fields, {}, map, nameOf)).toBe(entry);
  });

  it("follows a chain: hiding the size also hides what depends on it", () => {
    const out = withoutHiddenValues({ category: "Cards", fld_size: "A4", fld_lam: "Gloss" }, fields, {}, map, nameOf);
    expect(out).toEqual({ category: "Cards" });
  });

  it("judges rules against the rest of the form too, and leaves empty values alone", () => {
    expect(withoutHiddenValues({ fld_size: "10 x 6" }, fields, { category: "Flex Printing" }, map, nameOf)).toEqual({ fld_size: "10 x 6" });
    expect(withoutHiddenValues({ category: "Cards", fld_size: "" }, fields, {}, map, nameOf)).toEqual({ category: "Cards", fld_size: "" });
  });
});
