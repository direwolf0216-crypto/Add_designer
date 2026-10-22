import { describe, expect, it } from "vitest";
import { categoryFromCustomData } from "../category";

describe("categoryFromCustomData", () => {
  it("reads the top-level pick-list", () => {
    expect(categoryFromCustomData({ fld_b_job_category: "Flex Printing" })).toBe("Flex Printing");
  });
  it("reads the first row of a repeatable Job Details section stored as an array", () => {
    expect(categoryFromCustomData({ rep_sec_job_event: [{ category: "ID Cards", qty: "2" }, { category: "Flex Printing" }] })).toBe("ID Cards");
  });
  it("reads rows stored as a JSON string, keyed by the mapped name", () => {
    expect(categoryFromCustomData({ rep_sec_job_event: JSON.stringify([{ category: "A3 Color Board Print", field_1: "19 x 13" }]) })).toBe("A3 Color Board Print");
  });
  it("is empty when nothing was picked", () => {
    expect(categoryFromCustomData({ rep_sec_job_event: "[{\"size\":\"A4\"}]" })).toBe("");
    expect(categoryFromCustomData(null)).toBe("");
    expect(categoryFromCustomData("not json")).toBe("");
  });
});
