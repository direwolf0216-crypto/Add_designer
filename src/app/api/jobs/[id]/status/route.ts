import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { badRequest, notFound, parseJson, route } from "@/lib/api/http";
import { requirePermission } from "@/lib/auth/session";
import { isProductionDone } from "@/lib/services/jobs";

const MAX_CUSTOM_DATA_CHARS = 100_000;
const fitsIn = (maxChars: number) => (value: unknown) => value === undefined || JSON.stringify(value).length <= maxChars;

const statusSchema = z.object({
  status: z.string().trim().min(1, "Status is required").max(100),
  finishingStatus: z
    .string()
    .transform((v) => v.toUpperCase())
    .pipe(z.enum(["PENDING", "IN_PROGRESS", "DELIVERED"]))
    .optional(),
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

export const PATCH = route<{ id: string }>(async (req, { params }) => {
  const user = await requirePermission("manage_jobs");
  const { id } = await params;
  const { status, finishingStatus, customData: patch } = await parseJson(req, statusSchema);

  const existing = await prisma.job.findUnique({ where: { id } });
  if (!existing || existing.deletedAt) throw notFound("Job not found");

  const data: Prisma.JobUncheckedUpdateInput = { status, updatedById: user.id };
  const customData = { ...readCustomData(existing.customData), ...patch };

  if (isProductionDone(status)) {
    // Finishing starts as Pending once printing is done.
    if (!customData.fld_b_finishing_status) customData.fld_b_finishing_status = "Pending";
  } else if (finishingStatus) {
    data.finishingStatus = finishingStatus;
  }
  if (patch?.fld_b_finishing_status === "Delivered") data.proofDelivered = true;

  if (patch || customData.fld_b_finishing_status !== readCustomData(existing.customData).fld_b_finishing_status) {
    if (!fitsIn(MAX_CUSTOM_DATA_CHARS * 2)(customData)) throw badRequest("Custom data is too large");
    data.customData = customData as Prisma.InputJsonValue;
  }

  const updatedJob = await prisma.job.update({ where: { id }, data });

  await prisma.systemLog.create({
    data: { userId: user.id, action: "JOB_STATUS_UPDATED", details: `Updated job ID: ${id} status to ${status}` },
  });

  return NextResponse.json(updatedJob);
});
