import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { route } from "@/lib/api/http";
import { requirePermission } from "@/lib/auth/session";

export const GET = route(async () => {
  const user = await requirePermission("view_analytics");
  const alerts = await prisma.notification.findMany({
    where: { userId: user.id, isRead: false, priority: "HIGH" },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  return NextResponse.json(alerts);
});
