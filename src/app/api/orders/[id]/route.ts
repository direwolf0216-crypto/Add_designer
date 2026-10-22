import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { notFound, parseJson, route } from "@/lib/api/http";
import { requireAdmin, requirePermission , requireAnyPermission } from "@/lib/auth/session";
import { jobScope } from "@/lib/jobs/scope";
import { parseAmount, round2 } from "@/lib/money";
import { refreshOrderTotals } from "@/lib/services/jobs";

const amount = z.union([z.number().nonnegative(), z.string().max(30)]);
// advance/due are accepted for backwards compatibility but derived from the job's payments.
const updateSchema = z.object({
  packageAmount: amount.optional(),
  advanceAmount: amount.optional(),
  dueAmount: amount.optional(),
});

export const GET = route<{ id: string }>(async (_req, { params }) => {
  const user = await requirePermission("view_amounts");
  const { id } = await params;

  const order = await prisma.order.findFirst({
    where: { id, job: await jobScope(user) },
    include: { job: { include: { client: true } } },
  });
  if (!order || order.job.deletedAt) throw notFound("Order not found");

  return NextResponse.json(order, { headers: { "Cache-Control": "private, no-store" } });
});

export const PUT = route<{ id: string }>(async (req, { params }) => {
  await requireAnyPermission("create_jobs", "edit_jobs");
  await requirePermission("view_amounts");
  const { id } = await params;
  const body = await parseJson(req, updateSchema);

  const updated = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id }, include: { job: { select: { deletedAt: true } } } });
    if (!order || order.job.deletedAt) throw notFound("Order not found");
    if (body.packageAmount !== undefined) {
      await tx.order.update({ where: { id }, data: { package: round2(parseAmount(body.packageAmount)) } });
    }
    return refreshOrderTotals(tx, order.jobId);
  });

  return NextResponse.json(updated, { headers: { "Cache-Control": "private, no-store" } });
});

export const DELETE = route<{ id: string }>(async (_req, { params }) => {
  await requireAdmin();
  const { id } = await params;

  await prisma.order.delete({ where: { id } });

  return NextResponse.json({ success: true }, { headers: { "Cache-Control": "private, no-store" } });
});
