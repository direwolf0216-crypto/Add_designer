import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { route } from "@/lib/api/http";
import { requirePermission } from "@/lib/auth/session";
import { round2 } from "@/lib/money";
import { businessYearMonth, monthlyCategorySpend } from "@/lib/services/transactions";

export const GET = route(async () => {
  const user = await requirePermission("view_transactions");
  const now = new Date();
  const { month, year } = businessYearMonth(now);

  const budgets = await prisma.categoryBudget.findMany({
    where: { userId: user.id, month, year },
    orderBy: { category: "asc" },
    take: 200,
  });
  if (budgets.length === 0) {
    return NextResponse.json({ overview: [], alerts: [] });
  }

  const spentByCategory = await monthlyCategorySpend(budgets.map((b) => b.category), now);

  const overview = budgets.map((budget) => {
    const spent = spentByCategory.get(budget.category) ?? 0;
    const percentage = budget.monthlyLimit > 0 ? (spent / budget.monthlyLimit) * 100 : spent > 0 ? 100 : 0;
    const status = percentage >= 100 ? "exceeded" : percentage >= 80 ? "warning" : "good";
    return {
      category: budget.category,
      limit: budget.monthlyLimit,
      spent,
      remaining: round2(budget.monthlyLimit - spent),
      percentage: Math.min(percentage, 100),
      status,
    };
  });

  const alerts = overview
    .filter((o) => o.status === "exceeded")
    .map((o) => ({
      category: o.category,
      message: `⚠️ ${o.category} budget exceeded by ₹${round2(o.spent - o.limit).toLocaleString("en-IN")}`,
    }));

  return NextResponse.json({ overview, alerts });
});
