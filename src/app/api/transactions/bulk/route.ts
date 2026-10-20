import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { route, parseJson } from "@/lib/api/http";
import { requirePermission } from "@/lib/auth/session";
import { newGroupId, newTransactionRef, withUniqueRetry } from "@/lib/ids";
import { assertSingleType, bulkTransactionSchema, transactionData } from "@/lib/services/transactions";

export const POST = route(async (request) => {
  const user = await requirePermission("view_transactions");
  const items = await parseJson(request, bulkTransactionSchema);
  assertSingleType(items);

  // One INSERT … RETURNING is atomic. A transactionId collision fails the whole statement, so the
  // retry regenerates every reference (and the group id) and inserts again.
  const created = await withUniqueRetry(
    (groupId) =>
      prisma.transaction.createManyAndReturn({
        data: items.map((item) => ({
          ...transactionData(item),
          transactionId: newTransactionRef(),
          userId: user.id,
          groupId,
        })),
      }),
    newGroupId
  );

  return NextResponse.json(created, { status: 201, headers: { "Cache-Control": "private, no-store" } });
});
