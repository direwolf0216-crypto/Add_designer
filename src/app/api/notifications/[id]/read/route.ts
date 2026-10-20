import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { notFound, route } from "@/lib/api/http";
import { requireUser } from "@/lib/auth/session";

export const PATCH = route<{ id: string }>(async (_req, { params }) => {
  const { id: userId } = await requireUser();
  const { id } = await params;

  const { count } = await prisma.notification.updateMany({
    where: { id, userId },
    data: { isRead: true },
  });
  if (count === 0) throw notFound("Notification not found");

  return NextResponse.json({ success: true });
});
