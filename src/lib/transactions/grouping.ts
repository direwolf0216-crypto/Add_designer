// Collapsing of multi-line ("bulk") transactions that share a `groupId` into one display row.
//
// The list and overview pages group slightly differently, so there are two functions:
//  - groupTransactions (All Transactions list): row keeps the first line's fields, categories are
//    de-duplicated and joined with "+", amounts are coerced with Number(), description is cleared.
//  - groupLedgerTransactions (overview "Today's Transactions"): a minimal row whose category is every
//    line's category joined with " + " (duplicates kept) and whose amount is the raw sum.
// In both, a group with a single line is shown as that plain line.
import type { TransactionRecord } from "./types";

export type TransactionListGroup = TransactionRecord & {
  isGroup: true;
  children: TransactionRecord[];
  totalAmount: number;
  categoryNames: string[];
};

export type TransactionListItem = (TransactionRecord & { isGroup?: false }) | TransactionListGroup;

export function groupTransactions(transactions: TransactionRecord[]): TransactionListItem[] {
  const items: TransactionListItem[] = [];
  const grouped = new Map<string, TransactionListGroup>();

  transactions.forEach((tx) => {
    if (tx.groupId) {
      let group = grouped.get(tx.groupId);
      if (!group) {
        group = { ...tx, isGroup: true, children: [], totalAmount: 0, categoryNames: [], id: tx.groupId };
        grouped.set(tx.groupId, group);
        items.push(group);
      }
      group.children.push(tx);
      group.totalAmount += Number(tx.amount) || 0;
      if (!group.categoryNames.includes(tx.category)) {
        group.categoryNames.push(tx.category);
      }
    } else {
      items.push(tx);
    }
  });

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.isGroup) {
      if (item.children.length === 1) {
        // Convert back to single row
        items[i] = item.children[0];
      } else {
        item.amount = item.totalAmount;
        item.category = item.categoryNames.join("+");
        item.description = "";
      }
    }
  }

  return items;
}

export interface LedgerGroup {
  isGroup: true;
  id: string;
  groupId: string;
  category: string;
  type: string;
  amount: number;
  date: string;
  paymentMode?: string;
  children: TransactionRecord[];
  // Not set on groups; declared so rows can read them uniformly.
  description?: undefined;
  transactionId?: undefined;
  productOrderId?: undefined;
  jobId?: undefined;
}

export type LedgerItem = (TransactionRecord & { isGroup?: false }) | LedgerGroup;

export function groupLedgerTransactions(transactions: TransactionRecord[]): LedgerItem[] {
  const items: LedgerItem[] = [];
  const grouped = new Map<string, LedgerGroup>();

  transactions.forEach((tx) => {
    if (tx.groupId) {
      const group = grouped.get(tx.groupId);
      if (!group) {
        const created: LedgerGroup = {
          isGroup: true,
          id: tx.groupId,
          groupId: tx.groupId,
          category: tx.category,
          type: tx.type,
          amount: tx.amount,
          date: tx.date,
          paymentMode: tx.paymentMode,
          children: [tx],
        };
        grouped.set(tx.groupId, created);
        items.push(created);
      } else {
        group.children.push(tx);
        group.amount += tx.amount;
        group.category += " + " + tx.category;
      }
    } else {
      items.push(tx);
    }
  });

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.isGroup && item.children.length === 1) {
      items[i] = item.children[0];
    }
  }

  return items;
}
