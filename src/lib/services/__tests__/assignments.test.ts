import { describe, expect, it } from "vitest";
import { assignmentDiff } from "../assignments";

describe("assignmentDiff", () => {
  it("finds added and removed users", () => {
    expect(assignmentDiff(["a", "b"], ["b", "c"])).toEqual({ added: ["c"], removed: ["a"] });
  });
  it("is a no-op for the same set in a different order", () => {
    expect(assignmentDiff(["a", "b"], ["b", "a", "a"])).toEqual({ added: [], removed: [] });
  });
});
