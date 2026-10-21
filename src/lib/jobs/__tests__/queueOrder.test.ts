import { describe, expect, it } from "vitest";
import { assignPlaces, groupQueue, moveInQueue } from "../queueOrder";

const q = [
  { id: "a", priority: "URGENT" as const },
  { id: "b", priority: "NORMAL" as const },
  { id: "c", priority: "NORMAL" as const },
  { id: "d", priority: "LOW" as const },
];
const ids = (items: { id: string }[]) => items.map((i) => i.id).join("");

describe("queue order", () => {
  it("groups by priority, most urgent first", () => {
    expect(groupQueue(q).map((g) => `${g.priority}:${ids(g.items)}`)).toEqual(["URGENT:a", "HIGH:", "NORMAL:bc", "LOW:d"]);
  });

  it("reorders within a group", () => {
    expect(ids(moveInQueue(q, "c", "NORMAL", 0))).toBe("acbd");
  });

  it("moving into another group changes the priority", () => {
    const next = moveInQueue(q, "d", "URGENT", 0);
    expect(ids(next)).toBe("dabc");
    expect(next[0].priority).toBe("URGENT");
  });

  it("clamps the index and ignores unknown ids", () => {
    expect(ids(moveInQueue(q, "a", "HIGH", Infinity))).toBe("abcd");
    expect(moveInQueue(q, "zz", "LOW", 0)).toBe(q);
  });

  it("numbers each group, staying above hidden jobs further down", () => {
    expect(assignPlaces(q, {}).map((i) => `${i.id}${i.place}`)).toEqual(["a1", "b1", "c2", "d1"]);
    // Hidden Normal jobs start at position 2: the visible ones go to 0 and 1.
    expect(assignPlaces(q, { NORMAL: 2 }).map((i) => `${i.id}${i.place}`)).toEqual(["a1", "b0", "c1", "d1"]);
  });
});
