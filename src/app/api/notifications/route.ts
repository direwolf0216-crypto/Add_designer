import { NextResponse } from "next/server";
import { NotificationPriority, NotificationType, type Prisma } from "@prisma/client";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { intParam, route } from "@/lib/api/http";
import { requireUser } from "@/lib/auth/session";

const REMINDER_TYPES: NotificationType[] = [
  NotificationType.ORDER_STATUS_STALE,
  NotificationType.JOB_STATUS_STALE,
  NotificationType.PAYMENT_DUE_REMINDER,
  NotificationType.ADVANCE_NOT_COLLECTED,
  NotificationType.PROOF_NOT_DELIVERED,
  NotificationType.FINISHING_PENDING_REMINDER,
];

const querySchema = z.object({
  priority: z.enum(NotificationPriority).optional(),
  isRead: z.enum(["true", "false"]).optional(),
});

export const GET = route(async (req) => {
  const { id: userId } = await requireUser();
  const url = new URL(req.url);
  const limit = intParam(url, "limit", 50, 1, 100);
  const query = querySchema.parse({
    priority: url.searchParams.get("priority") || undefined,
    isRead: url.searchParams.get("isRead") || undefined,
  });

  const notSnoozed: Prisma.NotificationWhereInput = {
    OR: [{ snoozedUntil: null }, { snoozedUntil: { lt: new Date() } }],
  };

  const where: Prisma.NotificationWhereInput = { userId, ...notSnoozed };
  if (query.priority) where.priority = query.priority;
  if (query.isRead) where.isRead = query.isRead === "true";

  const [notifications, unreadCount, unreadReminderCount] = await Promise.all([
    prisma.notification.findMany({ where, orderBy: { createdAt: "desc" }, take: limit }),
    prisma.notification.count({
      where: { userId, isRead: false, type: { notIn: REMINDER_TYPES }, ...notSnoozed },
    }),
    prisma.notification.count({
      where: { userId, isRead: false, type: { in: REMINDER_TYPES }, ...notSnoozed },
    }),
  ]);

  return NextResponse.json({ notifications, unreadCount, unreadReminderCount });
});
