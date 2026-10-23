import { NextResponse } from "next/server";
import { route } from "@/lib/api/http";
import { requirePermission } from "@/lib/auth/session";
import { loadDashboardOverview } from "@/lib/dashboard/overview";

export const GET = route(async (req) => {
  const user = await requirePermission("view_analytics");
  const { searchParams } = new URL(req.url);
  return NextResponse.json(await loadDashboardOverview(user, searchParams.get("startDate"), searchParams.get("endDate")));
});
