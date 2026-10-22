import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { intParam, notFound, parseJson, route } from "@/lib/api/http";
import { requirePermission , requireAnyPermission } from "@/lib/auth/session";
import { jobScope } from "@/lib/jobs/scope";
import { parseAmount, round2 } from "@/lib/money";
import { refreshOrderTotals } from "@/lib/services/jobs";

const amount = z.union([z.number().nonnegative(), z.string().max(30)]);
// advance/due are accepted for backwards compatibility but derived from the job's payments.
const createSchema = z.object({
  jobId: z.string().min(1).max(50),
  packageAmount: amount.optional(),
  advanceAmount: amount.optional(),
  dueAmount: amount.optional(),
});

export const GET = route(async (req) => {
  // Orders are prices: only for roles that see amounts, and only for jobs the user can see.
  const user = await requirePermission("view_amounts");
  const url = new URL(req.url);

  const orders = await prisma.order.findMany({
    where: { job: { deletedAt: null, ...(await jobScope(user)) } },
    include: { job: { include: { client: true } } },
    orderBy: { createdAt: "desc" },
    take: intParam(url, "limit", 500, 1, 500),
    skip: intParam(url, "offset", 0, 0, 1_000_000),
  });

  return NextResponse.json(orders, { headers: { "Cache-Control": "private, no-store" } });
});

export const POST = route(async (req) => {
  await requireAnyPermission("create_jobs", "edit_jobs");
  await requirePermission("view_amounts");
  const body = await parseJson(req, createSchema);

  const order = await prisma.$transaction(async (tx) => {
    const job = await tx.job.findUnique({ where: { id: body.jobId }, select: { deletedAt: true } });
    if (!job || job.deletedAt) throw notFound("Job not found");
    await tx.order.create({ data: { jobId: body.jobId, package: round2(parseAmount(body.packageAmount ?? 0)) } });
    return refreshOrderTotals(tx, body.jobId);
  });

  return NextResponse.json(order, { status: 201, headers: { "Cache-Control": "private, no-store" } });
});
