import { NextResponse } from "next/server";
import { categoryFromCustomData } from "@/lib/jobs/category";
import { parseJobFilters } from "@/lib/jobs/filters";
import { buildJobWhere } from "@/lib/jobs/where";
import { jobScope, mineWhere } from "@/lib/jobs/scope";
import { notifyAssigned } from "@/lib/services/assignments";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { intParam, notFound, parseJson, route } from "@/lib/api/http";
import { requirePermission, userCan } from "@/lib/auth/session";
import { calendarDateToUtc } from "@/lib/dates";
import { parseAmount } from "@/lib/money";
import { actorName, broadcastLater, jobLabel } from "@/lib/notifications";
import { saveJob } from "@/lib/services/jobs";
import { hasFullAccess } from "@/lib/permissions";
import { jobMoneyKeys, redactJobAmounts } from "@/lib/jobs/redact";

const DAY_MS = 24 * 60 * 60 * 1000;
const fitsIn = (maxChars: number) => (value: unknown) => value === undefined || JSON.stringify(value).length <= maxChars;
const dateString = z.string().max(40).refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date");
const amount = z.union([z.number().nonnegative(), z.string().max(30)]);
const optionalText = (max: number) => z.string().trim().max(max).optional();
const httpUrl = z.union([z.url({ protocol: /^https?$/ }).max(2000), z.literal("")]).nullish();

const createSchema = z
  .object({
    clientId: z.string().max(50).optional(),
    client: z
      .object({
        name: z.string().trim().min(1).max(200),
        phone: optionalText(30),
        email: z.union([z.email().max(200), z.literal("")]).nullish(),
      })
      .optional(),
    category: optionalText(100),
    date: dateString,
    time: z.string().trim().min(1).max(50),
    location: z.string().trim().min(1).max(500),
    status: optionalText(100),
    packageName: optionalText(200),
    notes: optionalText(5000),
    packageAmount: amount.optional(),
    installments: z
      .array(z.object({ amount, date: dateString.optional(), paymentMode: optionalText(50) }))
      .max(50)
      .optional(),
    finishingStatus: z
      .string()
      .transform((v) => v.toUpperCase())
      .pipe(z.enum(["PENDING", "IN_PROGRESS", "DELIVERED"]))
      .optional(),
    proofDelivered: z.boolean().optional(),
    proofUrl: httpUrl,
    contractUrl: httpUrl,
    inclusions: z.unknown().refine(fitsIn(20_000), "Inclusions are too large").optional(),
    attachments: z.array(z.unknown()).max(100).refine(fitsIn(100_000), "Attachments are too large").optional(),
    assigneeIds: z.array(z.string().min(1).max(64)).max(20).optional(),
    customData: z
      .record(z.string().max(100), z.unknown())
      .refine((o) => Object.keys(o).length <= 200, "Too many custom fields")
      .refine(fitsIn(100_000), "Custom data is too large")
      .optional(),
  })
  .refine((b) => b.client || b.clientId, { message: "client or clientId is required", path: ["client"] });

/** `yyyy-MM-dd` filters are calendar dates (jobs are stored at UTC midnight); anything else is an instant. */
const parseDateParam = (value: string | null) => {
  if (!value) return undefined;
  const parsed = dateString.safeParse(value);
  if (!parsed.success) return undefined;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? calendarDateToUtc(value) : new Date(value);
};

export const GET = route(async (req) => {
  const user = await requirePermission("view_jobs");
  const url = new URL(req.url);
  const { searchParams } = url;
  const limit = intParam(url, "limit", 100, 1, 500);
  const offset = intParam(url, "offset", 0, 0, 1_000_000);

  // Trashed jobs are only listed for admins; `deletedAt: undefined` opts out of the soft-delete filter.
  const includeDeleted = searchParams.get("includeDeleted") === "true" && hasFullAccess(user.role);
  // List filters (categories, statuses, client, location, from, to, min, max) — same as the All Jobs page.
  const canSeeAmounts = await userCan(user, "view_amounts");
  const filters = parseJobFilters(searchParams);
  // Filtering by a hidden amount would reveal it.
  if (!canSeeAmounts) Object.assign(filters, { amountMin: "", amountMax: "" });
  const where: Prisma.JobWhereInput = {
    ...buildJobWhere(filters),
    ...(await jobScope(user)),
    deletedAt: includeDeleted ? undefined : null,
  };
  // `assignee=me` (My Jobs) or a specific user id; combined with the visibility scope above.
  const assignee = searchParams.get("assignee");
  if (assignee) {
    // "me" also covers the jobs waiting in my teams' stages.
    const mine = assignee === "me" ? await mineWhere(user.id) : { assignments: { some: { userId: assignee } } };
    where.AND = [...((where.AND as Prisma.JobWhereInput[] | undefined) ?? []), mine];
  }

  const start = parseDateParam(searchParams.get("startDate"));
  const endRaw = searchParams.get("endDate");
  const end = parseDateParam(endRaw);
  if (start || end) {
    where.date = {
      ...((where.date as Prisma.DateTimeFilter | undefined) ?? {}),
      ...(start ? { gte: start } : {}),
      // A calendar end date includes that whole day.
      ...(end ? (/^\d{4}-\d{2}-\d{2}$/.test(endRaw ?? "") ? { lt: new Date(end.getTime() + DAY_MS) } : { lte: end }) : {}),
    };
  }

  const [jobs, total] = await Promise.all([
    prisma.job.findMany({
      where,
      select: {
        id: true,
        jobNumber: true,
        clientId: true,
        category: true,
        date: true,
        time: true,
        location: true,
        status: true,
        packageName: true,
        customData: true,
        createdAt: true,
        client: { select: { id: true, name: true, phone: true } },
        order: { select: { id: true, package: true, advance: true, due: true } },
        assignments: { select: { userId: true, user: { select: { id: true, name: true, image: true } } } },
      },
      orderBy: { date: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.job.count({ where }),
  ]);

  const keys = canSeeAmounts ? null : await jobMoneyKeys();
  const items = keys ? jobs.map((j) => redactJobAmounts(j, keys)) : jobs;
  return NextResponse.json({ items, total, limit, offset }, { headers: { "Cache-Control": "private, no-store" } });
});

export const POST = route(async (req) => {
  const user = await requirePermission("create_jobs");
  const body = await parseJson(req, createSchema);

  let client = body.client;
  if (!client) {
    const existing = await prisma.client.findUnique({ where: { id: body.clientId! } });
    if (!existing) throw notFound("Client not found");
    client = { name: existing.name, phone: existing.phone, email: existing.email };
  }

  const result = await saveJob(
    {
      client: { name: client.name, phone: client.phone, email: client.email || null },
      category: body.category || categoryFromCustomData(body.customData),
      date: body.date,
      time: body.time,
      location: body.location,
      status: body.status || "Confirmed",
      packageAmount: parseAmount(body.packageAmount ?? 0),
      installments: body.installments ?? [],
      finishingStatus: body.finishingStatus,
      proofDelivered: body.proofDelivered,
      packageName: body.packageName,
      notes: body.notes,
      inclusions: body.inclusions,
      attachments: body.attachments,
      assigneeIds: body.assigneeIds,
      customData: body.customData ?? {},
    },
    user
  );
  notifyAssigned({ id: result.job.id, jobNumber: result.job.jobNumber, clientName: result.client.name }, result.assignmentChanges.added, user.id);

  let job = result.job;
  if (body.proofUrl !== undefined || body.contractUrl !== undefined) {
    job = await prisma.job.update({
      where: { id: job.id },
      data: { proofUrl: body.proofUrl, contractUrl: body.contractUrl },
    });
  }

  broadcastLater({
    title: "New job created",
    message: `${actorName(user)} created ${job.category ? `a ${job.category} job` : "job"} ${jobLabel(job, result.client.name)}.`,
    type: "JOB_CREATED",
    actionUrl: `/jobs/details/${job.id}`,
    entityId: job.id,
    entityType: "job",
    skipUserId: user.id,
  });

  const created = { ...job, client: { id: result.client.id, name: result.client.name }, order: result.order };
  const visible = (await userCan(user, "view_amounts")) ? created : redactJobAmounts(created, await jobMoneyKeys());
  return NextResponse.json(visible, { status: 201, headers: { "Cache-Control": "private, no-store" } });
});
