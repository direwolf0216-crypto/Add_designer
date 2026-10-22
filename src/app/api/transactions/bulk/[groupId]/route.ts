import { NextResponse } from "next/server";
import type { Transaction } from "@prisma/client";
import prisma from "@/lib/prisma";
import { route, parseJson, badRequest, notFound } from "@/lib/api/http";
import { requirePermission, type SessionUser } from "@/lib/auth/session";
import { newTransactionRef, withUniqueRetry } from "@/lib/ids";
import { sumAmounts } from "@/lib/money";
import { refreshOrderTotals } from "@/lib/services/jobs";
import {
  assertSingleType,
  bulkTransactionSchema,
  softDeleteTransactionTx,
  transactionData,
} from "@/lib/services/transactions";

/** The route's requirePermission already checked edit/delete; nothing further is owner-specific now. */
async function assertCanModifyGroup(_user: SessionUser, _rows: Transaction[]) {
  return;
}

export const GET = route<{ groupId: string }>(async (_request, { params }) => {
  await requirePermission("view_transactions");
  const { groupId } = await params;
  const transactions = await prisma.transaction.findMany({
    where: { groupId, deletedAt: null },
    orderBy: { createdAt: "asc" },
    take: 500,
  });
  if (transactions.length === 0) throw notFound("Transaction group not found");

  return NextResponse.json({
    transaction: {
      ...transactions[0],
      id: groupId,
      category: transactions.map((tx) => tx.category).join(", "),
      amount: sumAmounts(transactions.map((tx) => tx.amount)),
      items: transactions.map((tx) => ({ id: tx.id, transactionId: tx.transactionId, category: tx.category, amount: tx.amount })),
    },
  });
});

export const PUT = route<{ groupId: string }>(async (request, { params }) => {
  const user = await requirePermission("edit_transactions");
  const { groupId } = await params;
  const items = await parseJson(request, bulkTransactionSchema);
  assertSingleType(items);
  if (new Set(items.map((i) => i.category)).size !== items.length) {
    throw badRequest("Each category may appear only once");
  }

  const existing = await prisma.transaction.findMany({ where: { groupId, deletedAt: null }, orderBy: { createdAt: "asc" } });
  if (existing.length === 0) throw notFound("Transaction group not found");
  await assertCanModifyGroup(user, existing);

  // A unique violation aborts the whole Postgres transaction, so the retry wraps the transaction
  // and regenerates the references of any newly added categories.
  await withUniqueRetry(
    () =>
      prisma.$transaction(
        async (tx) => {
          const byCategory = new Map<string, Transaction[]>();
          for (const row of existing) byCategory.set(row.category, [...(byCategory.get(row.category) ?? []), row]);

          const toCreate = [];
          for (const item of items) {
            const data = transactionData(item);
            const match = byCategory.get(item.category)?.shift();
            if (match) {
              await tx.transaction.update({ where: { id: match.id }, data });
            } else {
              toCreate.push({ ...data, transactionId: newTransactionRef(), userId: user.id, groupId });
            }
          }
          if (toCreate.length > 0) await tx.transaction.createMany({ data: toCreate });

          // Categories removed from the group (and duplicates left over from older data).
          const removed = [...byCategory.values()].flat();
          for (const row of removed) await softDeleteTransactionTx(tx, row, user.id);
        },
        { timeout: 20000 }
      ),
    newTransactionRef
  );

  return NextResponse.json({ success: true });
});

export const DELETE = route<{ groupId: string }>(async (_request, { params }) => {
  const user = await requirePermission("delete_transactions");
  const { groupId } = await params;

  const existing = await prisma.transaction.findMany({ where: { groupId, deletedAt: null } });
  if (existing.length === 0) throw notFound("Group not found");
  await assertCanModifyGroup(user, existing);

  await prisma.$transaction(async (tx) => {
    const transactions = await tx.transaction.findMany({ where: { groupId, deletedAt: null } });
    const ids = transactions.map((t) => t.id);
    // The conditional update serialises concurrent deletes: the loser updates nothing and stops,
    // so the group never gets a second bin entry.
    const { count } = await tx.transaction.updateMany({
      where: { id: { in: ids }, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    if (count === 0) return;

    await tx.recycleBin.create({
      data: {
        itemId: groupId,
        itemType: "TRANSACTION_GROUP",
        trashedById: user.id,
        originalData: JSON.parse(
          JSON.stringify({
            groupId,
            children: transactions,
            categoryNames: transactions.map((t) => t.category).join("+"),
            totalAmount: sumAmounts(transactions.map((t) => t.amount)),
          })
        ),
      },
    });

    const jobIds = new Set(transactions.flatMap((t) => (t.jobId ? [t.jobId] : [])));
    for (const jobId of jobIds) await refreshOrderTotals(tx, jobId);
  });

  return NextResponse.json({ success: true });
});
