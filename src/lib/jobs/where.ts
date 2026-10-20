import "server-only";
import type { Prisma } from "@prisma/client";
import type { FilterState } from "@/types";
import { calendarDateToUtc } from "@/lib/dates";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Prisma filter for the job list/export. Job dates are calendar dates stored as UTC midnight. */
export function buildJobWhere(filters: FilterState): Prisma.JobWhereInput {
  const where: Prisma.JobWhereInput = { deletedAt: null };
  if (filters.categories.length) where.category = { in: filters.categories };
  if (filters.statuses.length) where.status = { in: filters.statuses };
  if (filters.clientName) where.client = { name: { contains: filters.clientName, mode: "insensitive" } };
  if (filters.location) where.location = { contains: filters.location, mode: "insensitive" };
  if (filters.dateStart || filters.dateEnd) {
    where.date = {
      ...(filters.dateStart ? { gte: calendarDateToUtc(filters.dateStart) } : {}),
      ...(filters.dateEnd ? { lt: new Date(calendarDateToUtc(filters.dateEnd).getTime() + DAY_MS) } : {}),
    };
  }
  if (filters.amountMin || filters.amountMax) {
    where.order = {
      package: {
        ...(filters.amountMin ? { gte: Number(filters.amountMin) } : {}),
        ...(filters.amountMax ? { lte: Number(filters.amountMax) } : {}),
      },
    };
  }
  return where;
}
