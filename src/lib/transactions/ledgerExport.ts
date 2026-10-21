// Ledger export content (CSV text and PDF tables) for the All Transactions list.
import { escapeCsv, toCsv } from "@/lib/export/csv";
import type { PdfTableSection } from "@/lib/export/pdf";
import type { TransactionRecord } from "./types";

export interface LedgerTotals {
  totalIncome: number;
  totalExpense: number;
  cashIncome: number;
  cashExpense: number;
  upiIncome: number;
  upiExpense: number;
}

/** Overall / cash / UPI income and expense. Modes match by substring, case-insensitively. */
export function summariseLedger(transactions: TransactionRecord[]): LedgerTotals {
  const t: LedgerTotals = { totalIncome: 0, totalExpense: 0, cashIncome: 0, cashExpense: 0, upiIncome: 0, upiExpense: 0 };
  transactions.forEach((tx) => {
    const amt = Number(tx.amount) || 0;
    const mode = (tx.paymentMode || "").toLowerCase();
    if (tx.type === "INCOME") {
      t.totalIncome += amt;
      if (mode.includes("cash")) t.cashIncome += amt;
      if (mode.includes("upi")) t.upiIncome += amt;
    } else if (tx.type === "EXPENSE") {
      t.totalExpense += amt;
      if (mode.includes("cash")) t.cashExpense += amt;
      if (mode.includes("upi")) t.upiExpense += amt;
    }
  });
  return t;
}

const CSV_HEADERS = ["Transaction ID", "Date", "Type", "Category", "Description", "Payment Mode", "Status", "Amount", "Attachment URL", "Custom Data", "Job ID"];

export function ledgerCsv(transactions: TransactionRecord[], totals = summariseLedger(transactions)): string {
  const rows = transactions.map((tx) => [
    escapeCsv(tx.transactionId),
    escapeCsv(new Date(tx.date).toLocaleDateString("en-IN")),
    escapeCsv(tx.type),
    escapeCsv(tx.category),
    escapeCsv(tx.description),
    escapeCsv(tx.paymentMode),
    escapeCsv(tx.status),
    escapeCsv(tx.amount),
    escapeCsv(tx.attachmentUrl),
    escapeCsv(tx.customData),
    escapeCsv(tx.jobId),
  ]);
  const { totalIncome, totalExpense, cashIncome, cashExpense, upiIncome, upiExpense } = totals;
  const summaryRows = [
    [],
    ["SUMMARY"],
    ["Metric", "Income", "Expense", "Net"],
    ["Overall", escapeCsv(totalIncome), escapeCsv(totalExpense), escapeCsv(totalIncome - totalExpense)],
    ["Cash", escapeCsv(cashIncome), escapeCsv(cashExpense), escapeCsv(cashIncome - cashExpense)],
    ["UPI", escapeCsv(upiIncome), escapeCsv(upiExpense), escapeCsv(upiIncome - upiExpense)],
  ];
  return toCsv([CSV_HEADERS, ...rows, ...summaryRows]);
}

export function ledgerPdfSections(transactions: TransactionRecord[], totals = summariseLedger(transactions)): PdfTableSection[] {
  const { totalIncome, totalExpense, cashIncome, cashExpense, upiIncome, upiExpense } = totals;
  return [
    {
      head: [["Transaction ID", "Date", "Type", "Category", "Description", "Payment Mode", "Status", "Amount"]],
      body: transactions.map((tx) => [
        tx.transactionId as string,
        new Date(tx.date).toLocaleDateString("en-IN"),
        tx.type,
        tx.category,
        tx.description || "",
        tx.paymentMode as string,
        tx.status as string,
        tx.amount.toString(),
      ]),
    },
    {
      heading: "Summary",
      head: [["Metric", "Income", "Expense", "Net"]],
      body: [
        ["Overall", totalIncome.toString(), totalExpense.toString(), (totalIncome - totalExpense).toString()],
        ["Cash", cashIncome.toString(), cashExpense.toString(), (cashIncome - cashExpense).toString()],
        ["UPI", upiIncome.toString(), upiExpense.toString(), (upiIncome - upiExpense).toString()],
      ],
    },
  ];
}
