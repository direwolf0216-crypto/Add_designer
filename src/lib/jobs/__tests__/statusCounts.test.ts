import { describe, expect, it } from "vitest";
import {
  applyJobTrackingUpdate,
  countJobsByStatus,
  filterJobsForStatusBoard,
  matchesJobSearch,
  matchesStatusTab,
  normaliseJobStatus,
  paginate,
  parseJobCustomData,
  type StatusBoardJob,
} from "../statusCounts";

const NOW = new Date("2026-10-20T12:00:00Z");
const job = (id: string, customData: unknown, extra: Partial<StatusBoardJob> = {}): StatusBoardJob => ({
  id,
  customData: typeof customData === "string" ? customData : JSON.stringify(customData),
  ...extra,
});

describe("parseJobCustomData", () => {
  it("parses strings, passes objects through and treats bad/empty input as {}", () => {
    expect(parseJobCustomData('{"a":1}')).toEqual({ a: 1 });
    expect(parseJobCustomData({ b: 2 })).toEqual({ b: 2 });
    expect(parseJobCustomData("{not json")).toEqual({});
    expect(parseJobCustomData(null)).toEqual({});
    expect(parseJobCustomData(undefined)).toEqual({});
  });
});

describe("normaliseJobStatus", () => {
  it("trims, lower-cases and defaults to pending", () => {
    expect(normaliseJobStatus({ fld_b_status: "  Printing " })).toBe("printing");
    expect(normaliseJobStatus({})).toBe("pending");
  });
});

describe("countJobsByStatus", () => {
  it("counts every card in one pass", () => {
    const jobs = [
      job("1", {}),
      job("2", { fld_b_status: "Pending" }),
      job("3", { fld_b_status: "Designing" }),
      job("4", { fld_b_status: "Printing", job_delivery_date: "2026-10-01" }),
      job("5", { fld_b_status: "Ready for Delivery" }),
      job("6", { fld_b_status: "Delivered", delivery_date: "2026-01-01" }),
      job("7", { fld_b_status: "Pending", delivery_date: "2027-01-01" }),
    ];
    expect(countJobsByStatus(jobs, NOW)).toEqual({
      Pending: 3,
      Designing: 1,
      Printing: 1,
      "Ready for Delivery": 1,
      Overdue: 1,
    });
  });

  it("matches statuses case-sensitively (unlike the tab filter)", () => {
    const counts = countJobsByStatus([job("1", { fld_b_status: "printing" }), job("2", { fld_b_status: "pending" })], NOW);
    expect(counts.Printing).toBe(0);
    expect(counts.Pending).toBe(0);
  });

  it("does not count an unparseable delivery date as overdue", () => {
    expect(countJobsByStatus([job("1", { job_delivery_date: "soon" })], NOW).Overdue).toBe(0);
  });

  it("treats bad customData as pending and tolerates a null list", () => {
    expect(countJobsByStatus([job("1", "{oops")], NOW).Pending).toBe(1);
    expect(countJobsByStatus(null, NOW).Pending).toBe(0);
  });
});

describe("matchesStatusTab", () => {
  it("compares status tabs case-insensitively", () => {
    expect(matchesStatusTab({ fld_b_status: "printing " }, "Printing", NOW)).toBe(true);
    expect(matchesStatusTab({}, "Pending", NOW)).toBe(true);
    expect(matchesStatusTab({ fld_b_status: "Designing" }, "Pending", NOW)).toBe(false);
  });

  it("overdue tab needs a past delivery date and a not-delivered status", () => {
    expect(matchesStatusTab({ job_delivery_date: "2026-10-01" }, "Overdue", NOW)).toBe(true);
    expect(matchesStatusTab({ job_delivery_date: "2026-12-01" }, "Overdue", NOW)).toBe(false);
    expect(matchesStatusTab({ fld_b_status: "Delivered", delivery_date: "2026-10-01" }, "Overdue", NOW)).toBe(false);
    expect(matchesStatusTab({}, "Overdue", NOW)).toBe(false);
  });

  it("overdue tab keeps an unparseable delivery date (unlike the count)", () => {
    expect(matchesStatusTab({ job_delivery_date: "soon" }, "Overdue", NOW)).toBe(true);
  });

  it("unknown tabs match everything", () => {
    expect(matchesStatusTab({ fld_b_status: "Delivered" }, "All", NOW)).toBe(true);
  });
});

describe("matchesJobSearch", () => {
  const j = job("abcd1234", {}, { client: { name: "Ravi Prints", phone: "98400" }, jobNumber: "JB-0042", category: "Banner" });

  it("matches client, phone, job number, category and id", () => {
    for (const q of ["ravi", "984", "jb-00", "BANNER", "cd12", ""]) {
      expect(matchesJobSearch(j, {}, q)).toBe(true);
    }
    expect(matchesJobSearch(j, {}, "zzz")).toBe(false);
  });

  it("matches the designer by team-user name, or by raw id when unknown", () => {
    const users = [{ id: "u1", name: "Meena" }];
    expect(matchesJobSearch(j, { designer: "u1" }, "meena", users)).toBe(true);
    expect(matchesJobSearch(j, { designer: "u9" }, "u9", users)).toBe(true);
  });
});

describe("filterJobsForStatusBoard", () => {
  it("applies tab then search", () => {
    const jobs = [
      job("1", { fld_b_status: "Printing" }, { client: { name: "Anu" } }),
      job("2", { fld_b_status: "Printing" }, { client: { name: "Bala" } }),
      job("3", { fld_b_status: "Pending" }, { client: { name: "Anu" } }),
    ];
    expect(filterJobsForStatusBoard(jobs, { tab: "Printing", now: NOW }).map((x) => x.id)).toEqual(["1", "2"]);
    expect(filterJobsForStatusBoard(jobs, { tab: "Printing", searchQuery: "anu", now: NOW }).map((x) => x.id)).toEqual(["1"]);
  });
});

describe("applyJobTrackingUpdate", () => {
  it("merges customData, re-serialises it and overrides status only when given", () => {
    const base = job("1", { fld_b_status: "Printing", designer: "u1" }, { status: "Confirmed" });
    const next = applyJobTrackingUpdate(base, { customData: { designer: "u2" } });
    expect(next.status).toBe("Confirmed");
    expect(JSON.parse(next.customData as string)).toEqual({ fld_b_status: "Printing", designer: "u2" });

    const done = applyJobTrackingUpdate(base, { status: "Delivered", customData: { fld_b_status: "Delivered" } });
    expect(done.status).toBe("Delivered");
    expect(base.status).toBe("Confirmed");
  });

  it("accepts object customData", () => {
    const next = applyJobTrackingUpdate({ id: "1", customData: { a: 1 } }, {});
    expect(next.customData).toBe('{"a":1}');
  });
});

describe("paginate", () => {
  const items = Array.from({ length: 30 }, (_, i) => i);

  it("slices pages and clamps past the end", () => {
    expect(paginate(items, 1, 25)).toMatchObject({ totalPages: 2, page: 1 });
    expect(paginate(items, 5, 25)).toEqual({ items: [25, 26, 27, 28, 29], totalPages: 2, page: 2 });
  });

  it("always has at least one page", () => {
    expect(paginate([], 3, 25)).toEqual({ items: [], totalPages: 1, page: 1 });
  });
});
