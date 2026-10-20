import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { notFound, parseJson, route } from "@/lib/api/http";
import { requireAdmin, requirePermission, requireUser } from "@/lib/auth/session";
import { round2 } from "@/lib/money";

const updateSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(2000).nullish(),
  price: z.coerce.number().nonnegative().max(100_000_000).transform(round2).optional(),
  stock: z.coerce.number().int().min(0).max(1_000_000).optional(),
});

export const GET = route<{ id: string }>(async (_req, { params }) => {
  await requireUser();
  const { id } = await params;

  const product = await prisma.product.findUnique({
    where: { id },
    include: { orders: { orderBy: { createdAt: "desc" }, take: 200 } },
  });
  if (!product) throw notFound("Product not found");

  return NextResponse.json(product, { headers: { "Cache-Control": "private, no-store" } });
});

export const PUT = route<{ id: string }>(async (req, { params }) => {
  await requirePermission("manage_jobs");
  const { id } = await params;
  const data = await parseJson(req, updateSchema);

  const updated = await prisma.product.update({ where: { id }, data });

  return NextResponse.json(updated, { headers: { "Cache-Control": "private, no-store" } });
});

export const DELETE = route<{ id: string }>(async (_req, { params }) => {
  await requireAdmin();
  const { id } = await params;

  // A product with orders is protected by the foreign key; route() maps that to 409.
  await prisma.product.delete({ where: { id } });

  return NextResponse.json({ success: true }, { headers: { "Cache-Control": "private, no-store" } });
});
