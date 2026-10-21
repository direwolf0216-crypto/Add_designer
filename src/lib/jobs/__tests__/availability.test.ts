import { describe, expect, it } from "vitest";
import { withAvailability } from "../availability";

describe("withAvailability", () => {
  const users = [{ id: "u1" }, { id: "u2" }];
  const jobs = [
    { id: "a", date: "2026-05-01T00:00:00Z", time: "10:00 AM", customData: { fld_op: "u1" } },
    { id: "b", date: "2026-05-01T00:00:00Z", time: "11:00 AM", customData: { fld_op: "u2" } },
  ];

  it("marks users referenced by another job at the same date and time", () => {
    expect(withAvailability(users, jobs, null, "2026-05-01", "10:00 AM")).toEqual([
      { id: "u1", isBusy: true },
      { id: "u2", isBusy: false },
    ]);
  });

  it("ignores the job being edited", () => {
    expect(withAvailability(users, jobs, "a", "2026-05-01", "10:00 AM").every((u) => !u.isBusy)).toBe(true);
  });
});
