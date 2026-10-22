import { describe, expect, it } from "vitest";
import { withoutArchivedFields } from "../archived";
import type { FormLayout } from "../types";

const layout: FormLayout = {
  sections: [
    { id: "s", title: "S", fields: [
      { id: "a", name: "A", type: "SINGLE_LINE" },
      { id: "b", name: "B", type: "SINGLE_LINE", archived: true },
    ] },
  ],
};

describe("withoutArchivedFields", () => {
  it("drops archived fields from the form layout", () => {
    expect(withoutArchivedFields(layout).sections[0].fields.map((f) => f.id)).toEqual(["a"]);
  });
  it("returns the same object when nothing is archived, and passes null through", () => {
    const plain: FormLayout = { sections: [{ id: "s", title: "S", fields: [{ id: "a", name: "A", type: "SINGLE_LINE" }] }] };
    expect(withoutArchivedFields(plain)).toBe(plain);
    expect(withoutArchivedFields(null)).toBeNull();
  });
});
