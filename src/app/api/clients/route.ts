import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { intParam, parseJson, route } from "@/lib/api/http";
import { requirePermission, requireUser } from "@/lib/auth/session";

const createSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  phone: z.string().trim().min(1, "Phone is required").max(30),
  email: z
    .union([z.email().max(200), z.literal("")])
    .nullish()
    .transform((v) => v || null),
});

export const GET = route(async (req) => {
  await requireUser();
  const url = new URL(req.url);
  const search = url.searchParams.get("search")?.trim().slice(0, 100);
  const limit = intParam(url, "limit", 200, 1, 500);
  const offset = intParam(url, "offset", 0, 0, 1_000_000);

  const where: Prisma.ClientWhereInput = search
    ? {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { phone: { contains: search } },
          { email: { contains: search, mode: "insensitive" } },
        ],
      }
    : {};

  const [clients, total] = await Promise.all([
    prisma.client.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      select: { id: true, name: true, phone: true, email: true, createdAt: true },
    }),
    prisma.client.count({ where }),
  ]);

  return NextResponse.json({ items: clients, total, limit, offset }, { headers: { "Cache-Control": "private, no-store" } });
});

export const POST = route(async (req) => {
  await requirePermission("manage_jobs");
  const data = await parseJson(req, createSchema);

  const newClient = await prisma.client.create({ data });

  return NextResponse.json(newClient, { status: 201, headers: { "Cache-Control": "private, no-store" } });
});
