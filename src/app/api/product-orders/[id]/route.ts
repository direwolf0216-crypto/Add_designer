import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { notFound, parseJson, route } from "@/lib/api/http";
import { requireAnyPermission, requireUser } from "@/lib/auth/session";
import { refreshOrderTotals } from "@/lib/services/jobs";

const updateSchema = z.object({
  quantity: z.coerce.number().int().min(1).max(10_000).optional(),
  status: z.string().trim().min(1).max(50).optional(),
  clientName: z.string().trim().min(1).max(200).optional(),
  clientPhone: z.string().trim().max(30).nullish(),
});

export const GET = route<{ id: string }>(async (_req, { params }) => {
  await requireUser();
  const { id } = await params;

  const productOrder = await prisma.productOrder.findUnique({ where: { id }, include: { product: true } });
  if (!productOrder) throw notFound("Product order not found");

  return NextResponse.json(productOrder, { headers: { "Cache-Control": "private, no-store" } });
});

export const PUT = route<{ id: string }>(async (req, { params }) => {
  await requireAnyPermission("create_jobs", "edit_jobs");
  const { id } = await params;
  const data = await parseJson(req, updateSchema);

  const updated = await prisma.productOrder.update({ where: { id }, data });

  return NextResponse.json(updated, { headers: { "Cache-Control": "private, no-store" } });
});

/** Moves the order to the recycle bin: snapshot it, hide its payments, then remove the row. */
export const DELETE = route<{ id: string }>(async (_req, { params }) => {
  const user = await requireAnyPermission("create_jobs", "edit_jobs");
  const { id } = await params;

  await prisma.$transaction(async (tx) => {
    const existing = await tx.productOrder.findUnique({ where: { id }, include: { transactions: true } });
    if (!existing) throw notFound("Product order not found");

    const live = existing.transactions.filter((t) => !t.deletedAt);
    await tx.recycleBin.create({
      data: {
        itemType: "product-order",
        itemId: id,
        // Restore brings back exactly these payments, not ones that were already deleted.
        originalData: JSON.parse(JSON.stringify({ ...existing, deletedTransactionIds: live.map((t) => t.id) })),
        trashedById: user.id,
      },
    });
    if (live.length > 0) {
      await tx.transaction.updateMany({ where: { id: { in: live.map((t) => t.id) } }, data: { deletedAt: new Date() } });
      for (const jobId of new Set(live.map((t) => t.jobId))) {
        if (jobId) await refreshOrderTotals(tx, jobId);
      }
    }
    await tx.productOrder.delete({ where: { id } });
    await tx.systemLog.create({
      data: { userId: user.id, action: "PRODUCT_ORDER_DELETED", details: `Moved product order ${id} to recycle bin` },
    });
  });

  return NextResponse.json({ success: true }, { headers: { "Cache-Control": "private, no-store" } });
});
