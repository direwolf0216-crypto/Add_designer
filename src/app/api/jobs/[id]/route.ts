import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { badRequest, notFound, parseJson, route } from "@/lib/api/http";
import { requireAdmin, requirePermission, requireUser, roleHasPermission } from "@/lib/auth/session";
import { calendarDateToUtc } from "@/lib/dates";
import { broadcastLater } from "@/lib/notifications";
import { hardDeleteJob, isProductionDone, softDeleteJob, updateJob } from "@/lib/services/jobs";
import { notifyAssigned } from "@/lib/services/assignments";
import { assertJobVisible, jobScope } from "@/lib/jobs/scope";

const fitsIn = (maxChars: number) => (value: unknown) => value === undefined || JSON.stringify(value).length <= maxChars;
const optionalText = (max: number) => z.string().trim().max(max).optional();
const httpUrl = z.union([z.url({ protocol: /^https?$/ }).max(2000), z.literal("")]).nullish();
const MAX_CUSTOM_DATA_CHARS = 100_000;

const updateSchema = z.object({
  category: optionalText(100),
  date: z.string().max(40).refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date").optional(),
  time: optionalText(50),
  location: optionalText(500),
  status: z.string().trim().min(1).max(100).optional(),
  proofUrl: httpUrl,
  contractUrl: httpUrl,
  packageName: optionalText(200),
  notes: optionalText(5000),
  inclusions: z.unknown().refine(fitsIn(20_000), "Inclusions are too large").optional(),
  attachments: z.array(z.unknown()).max(100).refine(fitsIn(100_000), "Attachments are too large").optional(),
  assigneeIds: z.array(z.string().min(1).max(64)).max(20).optional(),
  customData: z
    .record(z.string().max(100), z.unknown())
    .refine((o) => Object.keys(o).length <= 200, "Too many custom fields")
    .refine(fitsIn(MAX_CUSTOM_DATA_CHARS), "Custom data is too large")
    .optional(),
});

function readCustomData(value: Prisma.JsonValue | null): Record<string, unknown> {
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return value && typeof value === "object" && !Array.isArray(value) ? { ...(value as Record<string, unknown>) } : {};
}

export const GET = route<{ id: string }>(async (_req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  const canSeePayments = await roleHasPermission(user.role, "view_transactions");

  const job = await prisma.job.findFirst({
    where: { id, deletedAt: undefined, ...(await jobScope(user)) },
    include: {
      client: true,
      order: true,
      assignments: {
        orderBy: { assignedAt: "asc" },
        select: { userId: true, assignedAt: true, user: { select: { id: true, name: true, image: true, role: true } } },
      },
      transactions: canSeePayments ? { where: { deletedAt: null }, orderBy: { date: "asc" } } : false,
      createdBy: { select: { name: true, email: true } },
      updatedBy: { select: { name: true, email: true } },
    },
  });
  if (!job || job.deletedAt) throw notFound("Job not found");

  return NextResponse.json(
    { ...job, transactions: job.transactions ?? [] },
    { headers: { "Cache-Control": "private, no-store" } }
  );
});

export const PUT = route<{ id: string }>(async (req, { params }) => {
  const user = await requirePermission("manage_jobs");
  const { id } = await params;
  const body = await parseJson(req, updateSchema);

  const date = body.date ? (/^\d{4}-\d{2}-\d{2}$/.test(body.date) ? calendarDateToUtc(body.date) : new Date(body.date)) : undefined;

  const { before: existing, job: updated, assignmentChanges } = await updateJob(user, id, (current) => {
    let customData: Record<string, unknown> | undefined;
    if (body.customData || body.status !== undefined) {
      customData = { ...readCustomData(current.customData), ...body.customData };
      if (body.status !== undefined && isProductionDone(body.status) && !customData.fld_b_finishing_status) {
        customData.fld_b_finishing_status = "Pending";
      }
      if (!fitsIn(MAX_CUSTOM_DATA_CHARS * 2)(customData)) throw badRequest("Custom data is too large");
    }
    return {
      category: body.category,
      date,
      time: body.time,
      location: body.location,
      status: body.status,
      proofUrl: body.proofUrl,
      contractUrl: body.contractUrl,
      packageName: body.packageName,
      notes: body.notes,
      inclusions: body.inclusions === null ? Prisma.DbNull : (body.inclusions as Prisma.InputJsonValue | undefined),
      attachments: body.attachments as Prisma.InputJsonValue | undefined,
      customData: customData as Prisma.InputJsonValue | undefined,
      assigneeIds: body.assigneeIds,
    };
  });
  notifyAssigned({ id: updated.id, jobNumber: updated.jobNumber, clientName: existing.client.name }, assignmentChanges.added, user.id);

  await prisma.systemLog.create({
    data: { action: "JOB_UPDATED", details: `Updated job ID: ${updated.id} via API`, userId: user.id },
  });

  const label = updated.jobNumber || `#${updated.id.substring(0, 8)}`;
  const statusChanged = body.status !== undefined && body.status !== existing.status;
  broadcastLater({
    title: statusChanged ? "Job Status Update" : "Job Updated",
    message: statusChanged ? `Job ${label} status changed to ${updated.status}.` : `Job ${label} has been updated.`,
    type: "JOB_UPDATED",
    actionUrl: `/jobs/details/${updated.id}`,
    entityId: updated.id,
    entityType: "job",
    skipUserId: user.id,
  });

  return NextResponse.json(updated, { headers: { "Cache-Control": "private, no-store" } });
});

export const DELETE = route<{ id: string }>(async (req, { params }) => {
  const { id } = await params;
  const hard = new URL(req.url).searchParams.get("hard") === "true";

  if (hard) {
    const admin = await requireAdmin();
    await prisma.$transaction(
      async (tx) => {
        const job = await tx.job.findUnique({ where: { id }, select: { id: true } });
        if (!job) throw notFound("Job not found");
        const txs = await tx.transaction.findMany({ where: { jobId: id, deletedAt: undefined }, select: { id: true } });
        // Drop bin entries that would otherwise point at rows that no longer exist.
        await tx.recycleBin.deleteMany({
          where: {
            OR: [
              { itemType: { in: ["job", "booking"] }, itemId: id },
              { itemType: "transaction", itemId: { in: txs.map((t) => t.id) } },
            ],
          },
        });
        await hardDeleteJob(tx, id);
        await tx.systemLog.create({
          data: { action: "JOB_HARD_DELETED", details: `Hard deleted job ID: ${id} via API`, userId: admin.id },
        });
      },
      { timeout: 20000 }
    );
  } else {
    const user = await requirePermission("manage_jobs");
    await assertJobVisible(id, user);
    const deleted = await softDeleteJob(id, user.id);
    if (!deleted) throw notFound("Job not found");
  }

  return NextResponse.json({ success: true }, { headers: { "Cache-Control": "private, no-store" } });
});
