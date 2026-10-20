import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import prisma from "@/lib/prisma";
import { HttpError, route } from "@/lib/api/http";
import { purgeRateLimits } from "@/lib/rateLimit";
import { purgeItem } from "@/lib/services/recycleBin";

export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;
const RETENTION_DAYS = 30;
const REMINDER_LOG_RETENTION_DAYS = 90;
// Bounded per run so one invocation stays well inside the function timeout; the rest go next run.
const MAX_PER_RUN = 200;

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

  const cutoff = new Date(Date.now() - RETENTION_DAYS * DAY_MS);
  const entries = await prisma.recycleBin.findMany({
    where: { trashedAt: { lt: cutoff } },
    orderBy: { trashedAt: "asc" },
    take: MAX_PER_RUN,
  });

  let purgedCount = 0;
  let failedCount = 0;
  for (const entry of entries) {
    try {
      // Drive files are not removed here: that needs a user's Drive token.
      await purgeItem(entry, null);
      purgedCount++;
    } catch (e) {
      failedCount++;
      console.error(`[cron] failed to purge recycle-bin entry ${entry.id} (${entry.itemType} ${entry.itemId})`, e);
    }
  }

  await purgeRateLimits();
  const { count: reminderLogsPurged } = await prisma.reminderLog.deleteMany({
    where: { createdAt: { lt: new Date(Date.now() - REMINDER_LOG_RETENTION_DAYS * DAY_MS) } },
  });

  if (purgedCount > 0 || failedCount > 0) {
    await prisma.systemLog.create({
      data: {
        action: "CRON_PURGE_RECYCLE_BIN",
        details: `Purged ${purgedCount} recycle-bin items older than ${RETENTION_DAYS} days (${failedCount} failed)`,
        userId: null,
      },
    });
  }

  return NextResponse.json({ success: true, purgedCount, failedCount, reminderLogsPurged });
});
