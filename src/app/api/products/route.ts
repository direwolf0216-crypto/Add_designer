import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { intParam, parseJson, route } from "@/lib/api/http";
import { requireAnyPermission, requireUser } from "@/lib/auth/session";
import { round2 } from "@/lib/money";

const createSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  description: z.string().trim().max(2000).nullish(),
  price: z.coerce.number().nonnegative().max(100_000_000).transform(round2),
  stock: z.coerce.number().int().min(0).max(1_000_000).default(0),
});

export const GET = route(async (req) => {
  await requireUser();
  const url = new URL(req.url);
  const limit = intParam(url, "limit", 200, 1, 500);
  const offset = intParam(url, "offset", 0, 0, 1_000_000);

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      select: { id: true, name: true, description: true, price: true, stock: true, createdAt: true },
    }),
    prisma.product.count(),
  ]);

  return NextResponse.json({ items: products, total, limit, offset }, { headers: { "Cache-Control": "private, no-store" } });
});

export const POST = route(async (req) => {
  await requireAnyPermission("create_jobs", "edit_jobs");
  const data = await parseJson(req, createSchema);

  const newProduct = await prisma.product.create({ data });

  return NextResponse.json(newProduct, { status: 201, headers: { "Cache-Control": "private, no-store" } });
});
