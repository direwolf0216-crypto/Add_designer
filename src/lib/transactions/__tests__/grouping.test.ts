import { describe, expect, it } from "vitest";
import { groupLedgerTransactions, groupTransactions } from "../grouping";
import type { TransactionRecord } from "../types";

const t = (id: string, extra: Partial<TransactionRecord> = {}): TransactionRecord => ({
  id,
  date: "2026-10-21T05:00:00.000Z",
  type: "INCOME",
  category: "Xerox",
  amount: 10,
  paymentMode: "Cash",
  description: `desc ${id}`,
  ...extra,
});

describe("groupTransactions (list)", () => {
  it("collapses a multi-line group into one row at the first line's position", () => {
    const rows = groupTransactions([
      t("a"),
      t("b", { groupId: "grp_1", category: "Xerox", amount: 10 }),
      t("c"),
      t("d", { groupId: "grp_1", category: "PP", amount: "5" as unknown as number }),
      t("e", { groupId: "grp_1", category: "Xerox", amount: 1 }),
    ]);
    expect(rows.map((r) => r.id)).toEqual(["a", "grp_1", "c"]);
    const g = rows[1];
    if (!g.isGroup) throw new Error("expected group");
    expect(g.children.map((c) => c.id)).toEqual(["b", "d", "e"]);
    expect(g.amount).toBe(16);
    expect(g.categoryNames).toEqual(["Xerox", "PP"]);
    expect(g.category).toBe("Xerox+PP");
    expect(g.description).toBe("");
    // Other fields come from the first line.
    expect(g.paymentMode).toBe("Cash");
    expect(g.groupId).toBe("grp_1");
  });

  it("shows a single-line group as the plain line", () => {
    const only = t("x", { groupId: "grp_2" });
    expect(groupTransactions([only])).toEqual([only]);
  });

  it("does not mutate the input lines", () => {
    const b = t("b", { groupId: "grp_1" });
    const c = t("c", { groupId: "grp_1", category: "PP" });
    groupTransactions([b, c]);
    expect(b.category).toBe("Xerox");
    expect(b.id).toBe("b");
  });
});

describe("groupLedgerTransactions (overview)", () => {
  it("builds a minimal group with ' + '-joined categories (duplicates kept) and summed amount", () => {
    const rows = groupLedgerTransactions([
      t("b", { groupId: "grp_1", amount: 10 }),
      t("a"),
      t("c", { groupId: "grp_1", category: "PP", amount: 5 }),
      t("d", { groupId: "grp_1", amount: 1 }),
    ]);
    expect(rows.map((r) => r.id)).toEqual(["grp_1", "a"]);
    expect(rows[0]).toMatchObject({
      isGroup: true,
      groupId: "grp_1",
      category: "Xerox + PP + Xerox",
      amount: 16,
      type: "INCOME",
      paymentMode: "Cash",
      date: "2026-10-21T05:00:00.000Z",
    });
    expect(rows[0].description).toBeUndefined();
    expect(rows[0].transactionId).toBeUndefined();
  });

  it("shows a single-line group as the plain line", () => {
    const only = t("x", { groupId: "grp_2" });
    expect(groupLedgerTransactions([only])).toEqual([only]);
  });
});
