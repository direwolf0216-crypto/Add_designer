import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { intParam, notFound, parseJson, route } from "@/lib/api/http";
import { requirePermission, requireUser } from "@/lib/auth/session";
import { newOrderNumber, withUniqueRetry } from "@/lib/ids";

const createSchema = z.object({
  productId: z.string().min(1).max(50),
  quantity: z.coerce.number().int().min(1).max(10_000).default(1),
  status: z.string().trim().min(1).max(50).default("PENDING"),
  clientName: z.string().trim().min(1, "Client name is required").max(200),
  clientPhone: z.string().trim().max(30).nullish(),
});

export const GET = route(async (req) => {
  await requireUser();
  const url = new URL(req.url);

  const productOrders = await prisma.productOrder.findMany({
    include: { product: true },
    orderBy: { createdAt: "desc" },
    take: intParam(url, "limit", 500, 1, 500),
    skip: intParam(url, "offset", 0, 0, 1_000_000),
  });

  return NextResponse.json(productOrders, { headers: { "Cache-Control": "private, no-store" } });
});

export const POST = route(async (req) => {
  const user = await requirePermission("manage_jobs");
  const data = await parseJson(req, createSchema);

  const product = await prisma.product.findUnique({ where: { id: data.productId }, select: { id: true } });
  if (!product) throw notFound("Product not found");

  const newProductOrder = await withUniqueRetry(
    (orderNumber) => prisma.productOrder.create({ data: { ...data, orderNumber }, include: { product: true } }),
    newOrderNumber
  );

  await prisma.systemLog.create({
    data: {
      action: "PRODUCT_ORDER_CREATED",
      details: `New Order Received - Order ID: ${newProductOrder.id} for product ${newProductOrder.product.name}`,
      userId: user.id,
    },
  });

  return NextResponse.json(newProductOrder, { status: 201, headers: { "Cache-Control": "private, no-store" } });
});
