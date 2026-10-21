import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import prisma from "@/lib/prisma";
import { HttpError, route } from "@/lib/api/http";
import { addDays, calendarDateToUtc, toBusinessISODate } from "@/lib/dates";
import { claimReminder, createNotification } from "@/lib/notifications";

export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;
const BATCH_SIZE = 10;

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

export const GET = route(async (req) => {
  assertCron(req);

  // Job.date is a calendar date stored as UTC midnight; "tomorrow" is tomorrow in IST.
  const today = toBusinessISODate();
  const tomorrow = calendarDateToUtc(toBusinessISODate(addDays(new Date(), 1)));
  const dayAfter = new Date(tomorrow.getTime() + DAY_MS);

  const upcomingJobs = await prisma.job.findMany({
    where: {
      deletedAt: null,
      date: { gte: tomorrow, lt: dayAfter },
      NOT: [
        { status: { equals: "Cancelled", mode: "insensitive" } },
        { status: { equals: "Canceled", mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      category: true,
      location: true,
      assignments: { select: { userId: true } },
      client: { select: { name: true } },
    },
    take: 500,
  });

  if (upcomingJobs.length === 0) {
    return NextResponse.json({ success: true, message: "No jobs for tomorrow." });
  }

  const assigneeIds = (job: (typeof upcomingJobs)[number]) => job.assignments.map((a) => a.userId);
  const assigned = [...new Set(upcomingJobs.flatMap(assigneeIds))];
  const [admins, activeAssigned] = await Promise.all([
    prisma.user.findMany({ where: { role: { in: ["OWNER", "ADMIN"] }, status: "ACTIVE" }, select: { id: true } }),
    prisma.user.findMany({ where: { id: { in: assigned }, status: "ACTIVE" }, select: { id: true } }),
  ]);
  const activeIds = new Set(activeAssigned.map((u) => u.id));

  // Assigned users get the reminder; jobs with nobody (active) assigned go to the admins.
  const sends = upcomingJobs.flatMap((job) => {
    const crew = assigneeIds(job).filter((id) => activeIds.has(id));
    const recipients = crew.length > 0 ? [...new Set(crew)] : admins.map((a) => a.id);
    return recipients.map((userId) => ({ job, userId }));
  });

  let notificationsSent = 0;
  for (let i = 0; i < sends.length; i += BATCH_SIZE) {
    const results = await Promise.all(
      sends.slice(i, i + BATCH_SIZE).map(async ({ job, userId }) => {
        if (!(await claimReminder(`JOB_DUE_TOMORROW:${job.id}:${userId}:${today}`))) return null;
        return createNotification({
          userId,
          title: "Job Due Tomorrow!",
          message: `Reminder: ${job.category} job for ${job.client.name} is due tomorrow at ${job.location || "TBD"}.`,
          type: "HOT_DATE_ALERT",
          actionUrl: `/jobs/details/${job.id}`,
          entityId: job.id,
          entityType: "job",
          priority: "HIGH",
        });
      })
    );
    notificationsSent += results.filter(Boolean).length;
  }

  return NextResponse.json({
    success: true,
    message: `Sent ${notificationsSent} reminders for ${upcomingJobs.length} jobs.`,
  });
});
