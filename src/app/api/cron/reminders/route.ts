import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import type { NotificationType, Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { HttpError, route } from "@/lib/api/http";
import { businessTodayUtc, toBusinessISODate } from "@/lib/dates";
import { formatINR } from "@/lib/money";
import { claimReminder, createNotification } from "@/lib/notifications";
import { SHOOT_DONE_STATUSES } from "@/lib/services/jobs";

export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;
/** How far past a threshold a job is still reminded about; older jobs are assumed handled. */
const LOOKBACK_DAYS = 60;
const MAX_JOBS_PER_CHECK = 500;
const BATCH_SIZE = 10;

const REMINDER_TYPES: NotificationType[] = [
  "PAYMENT_DUE_REMINDER",
  "ADVANCE_NOT_COLLECTED",
  "GALLERY_NOT_DELIVERED",
  "ALBUM_PENDING_REMINDER",
];

/** Fails closed: without CRON_SECRET configured nothing is authorized. */
function assertCron(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) console.error("[cron] CRON_SECRET is not set; refusing to run");
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (!secret || given.length !== expected.length || !timingSafeEqual(given, expected)) {
    throw new HttpError(401, "Unauthorized");
  }
}

const NOT_CANCELLED: Prisma.JobWhereInput = {
  NOT: [
    { status: { equals: "Cancelled", mode: "insensitive" } },
    { status: { equals: "Canceled", mode: "insensitive" } },
  ],
};

function albumStatusOf(customData: Prisma.JsonValue | null): string {
  let cd: unknown = customData;
  if (typeof cd === "string") {
    try {
      cd = JSON.parse(cd);
    } catch {
      cd = null;
    }
  }
  const value = cd && typeof cd === "object" ? (cd as Record<string, unknown>).fld_b_album_status : undefined;
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

type ReminderJob = { id: string; date: Date; client: { name: string } | null };

export const GET = route(async (req) => {
  assertCron(req);

  const settings = await prisma.systemSetting.findMany({
    where: {
      key: {
        in: [
          "reminder_threshold_advance",
          "reminder_threshold_gallery",
          "reminder_threshold_album",
          "reminder_threshold_payment_due",
        ],
      },
    },
  });
  const threshold = (key: string, fallback: number) => {
    const value = settings.find((s) => s.key === key)?.value;
    const days = value && typeof value === "object" && "days" in value ? Number((value as { days: unknown }).days) : NaN;
    return Number.isInteger(days) && days >= 0 && days <= 365 ? days : fallback;
  };
  const thresholds = {
    advance: threshold("reminder_threshold_advance", 7),
    gallery: threshold("reminder_threshold_gallery", 14),
    album: threshold("reminder_threshold_album", 30),
    paymentDue: threshold("reminder_threshold_payment_due", 3),
  };

  // Job.date is a calendar date stored as UTC midnight, so compare against IST "today" as UTC midnight.
  const today = businessTodayUtc();
  const todayISO = toBusinessISODate();
  const day = (offset: number) => new Date(today.getTime() + offset * DAY_MS);
  const calendarDate = (d: Date) => d.toISOString().slice(0, 10);
  const now = new Date();

  const admins = await prisma.user.findMany({ where: { role: "ADMIN", status: "ACTIVE" }, select: { id: true } });
  if (admins.length === 0) return NextResponse.json({ success: true, notificationsCreated: 0 });

  const [advanceMissing, galleryCandidates, albumCandidates, dueJobs] = await Promise.all([
    // Jobs without an Order have collected nothing either.
    prisma.job.findMany({
      where: {
        deletedAt: null,
        date: { gte: today, lte: day(thresholds.advance) },
        status: { equals: "Confirmed", mode: "insensitive" },
        OR: [{ order: { is: null } }, { order: { advance: { lte: 0 } } }],
      },
      select: { id: true, date: true, client: { select: { name: true } } },
      orderBy: { date: "asc" },
      take: MAX_JOBS_PER_CHECK,
    }),
    prisma.job.findMany({
      where: {
        deletedAt: null,
        ...NOT_CANCELLED,
        galleryDelivered: false,
        date: { gte: day(-(thresholds.gallery + LOOKBACK_DAYS)), lt: day(-thresholds.gallery) },
      },
      select: { id: true, date: true, customData: true, client: { select: { name: true } } },
      orderBy: { date: "asc" },
      take: MAX_JOBS_PER_CHECK,
    }),
    prisma.job.findMany({
      where: {
        deletedAt: null,
        galleryDelivered: false,
        OR: SHOOT_DONE_STATUSES.map((s) => ({ status: { equals: s, mode: "insensitive" as const } })),
        date: { gte: day(-(thresholds.album + LOOKBACK_DAYS)), lt: day(-thresholds.album) },
      },
      select: { id: true, date: true, customData: true, client: { select: { name: true } } },
      orderBy: { date: "asc" },
      take: MAX_JOBS_PER_CHECK,
    }),
    prisma.job.findMany({
      where: {
        deletedAt: null,
        ...NOT_CANCELLED,
        date: { gte: today, lte: day(thresholds.paymentDue) },
        order: { due: { gt: 0 } },
      },
      select: { id: true, date: true, client: { select: { name: true } }, order: { select: { due: true } } },
      orderBy: { date: "asc" },
      take: MAX_JOBS_PER_CHECK,
    }),
  ]);

  type Reminder = { type: NotificationType; job: ReminderJob; title: string; message: string };
  const reminders: Reminder[] = [
    ...advanceMissing.map((job) => ({
      type: "ADVANCE_NOT_COLLECTED" as const,
      job,
      title: "Advance Missing",
      message: `No advance collected for ${job.client?.name} shoot on ${calendarDate(job.date)}.`,
    })),
    // The album being marked Delivered also counts as the gallery being handed over.
    ...galleryCandidates
      .filter((job) => albumStatusOf(job.customData) !== "delivered")
      .map((job) => ({
        type: "GALLERY_NOT_DELIVERED" as const,
        job,
        title: "Gallery Pending",
        message: `Gallery not delivered for ${job.client?.name} (event was ${thresholds.gallery}+ days ago).`,
      })),
    ...albumCandidates
      .filter((job) => ["", "pending"].includes(albumStatusOf(job.customData)))
      .map((job) => ({
        type: "ALBUM_PENDING_REMINDER" as const,
        job,
        title: "Album Pending",
        message: `Album status still PENDING for ${job.client?.name} (event was ${thresholds.album}+ days ago).`,
      })),
    ...dueJobs.map((job) => ({
      type: "PAYMENT_DUE_REMINDER" as const,
      job,
      title: "Payment Due Soon",
      message: `${formatINR(job.order?.due ?? 0)} due for ${job.client?.name}'s shoot on ${calendarDate(job.date)}.`,
    })),
  ];

  // A user who snoozed a reminder is not reminded again until the snooze ends.
  const snoozed = await prisma.notification.findMany({
    where: {
      type: { in: REMINDER_TYPES },
      snoozedUntil: { gt: now },
      entityId: { in: [...new Set(reminders.map((r) => r.job.id))] },
    },
    select: { type: true, entityId: true, userId: true },
  });
  const snoozedKeys = new Set(snoozed.map((n) => `${n.type}:${n.entityId}:${n.userId}`));

  const sends = reminders.flatMap((r) =>
    admins.map((a) => ({ ...r, userId: a.id })).filter((s) => !snoozedKeys.has(`${s.type}:${s.job.id}:${s.userId}`))
  );

  let notificationsCreated = 0;
  for (let i = 0; i < sends.length; i += BATCH_SIZE) {
    const results = await Promise.all(
      sends.slice(i, i + BATCH_SIZE).map(async (s) => {
        if (!(await claimReminder(`${s.type}:${s.job.id}:${s.userId}:${todayISO}`))) return null;
        return createNotification({
          userId: s.userId,
          type: s.type,
          title: s.title,
          message: s.message,
          actionUrl: `/jobs/details/${s.job.id}`,
          entityId: s.job.id,
          entityType: "job",
          priority: "HIGH",
        });
      })
    );
    notificationsCreated += results.filter(Boolean).length;
  }

  return NextResponse.json({ success: true, notificationsCreated });
});
