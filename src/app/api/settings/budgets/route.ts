import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { route, parseJson, intParam, badRequest, notFound } from "@/lib/api/http";
import { requirePermission } from "@/lib/auth/session";
import { round2 } from "@/lib/money";
import { businessYearMonth } from "@/lib/services/transactions";

const budgetSchema = z.object({
  category: z.string().trim().min(1).max(100),
  monthlyLimit: z.coerce.number().nonnegative().max(1e10).transform(round2),
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2000).max(2100),
});

// Budgets are personal: every query is scoped to the signed-in user.
export const GET = route(async (request) => {
  const user = await requirePermission("view_transactions");
  const url = new URL(request.url);
  const current = businessYearMonth();
  const month = intParam(url, "month", current.month, 1, 12);
  const year = intParam(url, "year", current.year, 2000, 2100);

  const budgets = await prisma.categoryBudget.findMany({
    where: { userId: user.id, month, year },
    orderBy: { category: "asc" },
    take: 500,
  });
  return NextResponse.json({ budgets });
});

export const POST = route(async (request) => {
  const user = await requirePermission("view_transactions");
  const { category, monthlyLimit, month, year } = await parseJson(request, budgetSchema);

  const budget = await prisma.categoryBudget.upsert({
    where: { category_month_year_userId: { category, month, year, userId: user.id } },
    update: { monthlyLimit },
    create: { category, monthlyLimit, month, year, userId: user.id },
  });
  return NextResponse.json({ budget });
});

export const DELETE = route(async (request) => {
  const user = await requirePermission("view_transactions");
  const id = new URL(request.url).searchParams.get("id");
  if (!id) throw badRequest("ID required");

  const { count } = await prisma.categoryBudget.deleteMany({ where: { id, userId: user.id } });
  if (count === 0) throw notFound("Budget not found");
  return NextResponse.json({ success: true });
});
