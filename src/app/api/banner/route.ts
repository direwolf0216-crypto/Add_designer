import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { businessTodayUtc } from "@/lib/dates";
import { asJsonObject } from "@/lib/services/transactions";

export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;
const TIME = /^\d{2}:\d{2}$/;

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ show: false });
  }

  try {
    const stored = asJsonObject((await prisma.systemSetting.findUnique({ where: { key: "BANNER_SETTINGS" } }))?.value);
    const settings = {
      ...stored,
      bannerEnabled: stored.bannerEnabled !== false,
      bannerTime1: typeof stored.bannerTime1 === "string" && TIME.test(stored.bannerTime1) ? stored.bannerTime1 : "09:00",
      bannerTime2: typeof stored.bannerTime2 === "string" && TIME.test(stored.bannerTime2) ? stored.bannerTime2 : "17:00",
    };
    if (!settings.bannerEnabled) {
      return NextResponse.json({ show: false });
    }

    // Job dates are calendar dates stored as UTC midnight, so "tomorrow" is today's business date + 1 day.
    const today = businessTodayUtc().getTime();
    const tomorrow = new Date(today + DAY_MS);
    const dayAfter = new Date(today + 2 * DAY_MS);
    const end = new Date(today + 3 * DAY_MS);

    const jobs = await prisma.job.findMany({
      where: { deletedAt: null, date: { gte: tomorrow, lt: end } },
      select: { id: true, date: true, time: true, category: true, status: true, location: true, client: { select: { name: true } } },
      orderBy: { date: "asc" },
      take: 200,
    });

    if (jobs.length === 0) {
      return NextResponse.json({ show: false });
    }

    return NextResponse.json({
      show: true,
      settings,
      day1: jobs.filter((j) => j.date < dayAfter),
      day2: jobs.filter((j) => j.date >= dayAfter),
    });
  } catch (error) {
    console.error("Banner API Error:", error);
    return NextResponse.json({ show: false });
  }
}
