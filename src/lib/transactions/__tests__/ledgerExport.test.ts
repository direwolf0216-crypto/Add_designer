import { describe, expect, it } from "vitest";
import { ledgerCsv, ledgerPdfSections, summariseLedger } from "../ledgerExport";
import type { TransactionRecord } from "../types";

const date = new Date(2026, 9, 21, 10).toISOString();
const rows: TransactionRecord[] = [
  { id: "1", transactionId: "TX-1", date, type: "INCOME", category: "Xerox", amount: 100, paymentMode: "Cash", status: "PAID", description: 'Say "hi"' },
  { id: "2", transactionId: "TX-2", date, type: "EXPENSE", category: "Tea", amount: 30, paymentMode: "UPI", status: "PAID", customData: { a: 1 }, jobId: "J1" },
  { id: "3", transactionId: "TX-3", date, type: "INCOME", category: "PP", amount: 20, paymentMode: "Bank Transfer", status: "PAID" },
];

describe("summariseLedger", () => {
  it("totals overall and by cash / UPI (substring, case-insensitive)", () => {
    expect(summariseLedger(rows)).toEqual({ totalIncome: 120, totalExpense: 30, cashIncome: 100, cashExpense: 0, upiIncome: 0, upiExpense: 30 });
    expect(summariseLedger([{ ...rows[0], amount: "7" as unknown as number, paymentMode: "Cash/UPI" }])).toMatchObject({ totalIncome: 7, cashIncome: 7, upiIncome: 7 });
  });
});

describe("ledgerCsv", () => {
  it("writes quoted rows followed by an unquoted-label summary block", () => {
    const lines = ledgerCsv(rows).split("\n");
    const day = new Date(date).toLocaleDateString("en-IN");
    expect(lines[0]).toBe("Transaction ID,Date,Type,Category,Description,Payment Mode,Status,Amount,Attachment URL,Custom Data,Job ID");
    expect(lines[1]).toBe(`"TX-1","${day}","INCOME","Xerox","Say ""hi""","Cash","PAID","100","","",""`);
    expect(lines[2]).toBe(`"TX-2","${day}","EXPENSE","Tea","","UPI","PAID","30","","{""a"":1}","J1"`);
    expect(lines.slice(4)).toEqual([
      "",
      "SUMMARY",
      "Metric,Income,Expense,Net",
      'Overall,"120","30","90"',
      'Cash,"100","0","100"',
      'UPI,"0","30","-30"',
    ]);
  });
});

describe("ledgerPdfSections", () => {
  it("returns the ledger table and a headed summary table", () => {
    const [ledger, summary] = ledgerPdfSections(rows);
    expect(ledger.heading).toBeUndefined();
    expect(ledger.head[0]).toHaveLength(8);
    expect(ledger.body[1]).toEqual(["TX-2", new Date(date).toLocaleDateString("en-IN"), "EXPENSE", "Tea", "", "UPI", "PAID", "30"]);
    expect(summary.heading).toBe("Summary");
    expect(summary.body).toEqual([
      ["Overall", "120", "30", "90"],
      ["Cash", "100", "0", "100"],
      ["UPI", "0", "30", "-30"],
    ]);
  });
});
