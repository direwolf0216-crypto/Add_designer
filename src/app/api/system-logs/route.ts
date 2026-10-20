import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { intParam, route } from "@/lib/api/http";
import { requireAdmin } from "@/lib/auth/session";

export const GET = route(async (request) => {
  await requireAdmin();

  const url = new URL(request.url);
  const limit = intParam(url, "limit", 100, 1, 500);
  const action = url.searchParams.get("action");

  const logs = await prisma.systemLog.findMany({
    where: action ? { action } : {},
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return NextResponse.json(logs, { headers: { "Cache-Control": "private, no-store" } });
});
