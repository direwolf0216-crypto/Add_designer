import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { route } from "@/lib/api/http";
import { requireUser } from "@/lib/auth/session";
import { businessTodayUtc } from "@/lib/dates";

/** Confirmed jobs whose (IST) job date has passed without being marked done. */
export const GET = route(async () => {
  await requireUser();

  const overdueJobs = await prisma.job.findMany({
    where: {
      deletedAt: null,
      status: { equals: "Confirmed", mode: "insensitive" },
      date: { lt: businessTodayUtc() },
    },
    include: { client: { select: { id: true, name: true, phone: true, email: true } } },
    orderBy: { date: "asc" },
    take: 200,
  });

  return NextResponse.json(overdueJobs, { headers: { "Cache-Control": "private, no-store" } });
});
