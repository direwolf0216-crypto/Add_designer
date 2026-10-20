import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { notFound, route } from "@/lib/api/http";
import { requireUser } from "@/lib/auth/session";

const SNOOZE_MS = 24 * 60 * 60 * 1000;

export const PATCH = route<{ id: string }>(async (_req, { params }) => {
  const { id: userId } = await requireUser();
  const { id } = await params;

  const snoozedUntil = new Date(Date.now() + SNOOZE_MS);
  const { count } = await prisma.notification.updateMany({
    where: { id, userId },
    data: { snoozedUntil },
  });
  if (count === 0) throw notFound("Notification not found");

  return NextResponse.json({ success: true, snoozedUntil });
});
