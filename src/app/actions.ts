"use server";

import { z } from "zod";
import { Prisma } from "@prisma/client";
import { jobSchema } from "@/lib/validations/job";
import type { Job } from "@/types";
import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { broadcastLater } from "@/lib/notifications";
import { getSessionUser, type SessionUser, userCan } from "@/lib/auth/session";
import type { Permission } from "@/lib/permissions";
import { isProductionDone, saveJob, softDeleteJob, updateJob, type InstallmentInput } from "@/lib/services/jobs";
import { notifyAssigned } from "@/lib/services/assignments";
import { recordJobActivity } from "@/lib/services/activity";
import { assertJobVisible } from "@/lib/jobs/scope";
import { parseAmount } from "@/lib/money";
import { nextCounter } from "@/lib/ids";
import { HttpError } from "@/lib/api/http";

type ActionError = { success: false; error: string };

/** Server actions are public endpoints: every one must authenticate and authorise itself. */
async function authorize(permission: Permission): Promise<SessionUser | ActionError> {
  const user = await getSessionUser();
  if (!user) return { success: false, error: "Unauthorized" };
  if (!(await userCan(user, permission))) {
    return { success: false, error: "You do not have permission to perform this action" };
  }
  return user;
}

const isError = (v: SessionUser | ActionError): v is ActionError => "success" in v;

function parseJsonField(value: FormDataEntryValue | undefined): unknown {
  if (typeof value !== "string" || value === "") return undefined;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

/** `assigneeIds` is posted as a JSON array of user ids; absent means "leave assignments unchanged". */
function parseAssigneeIds(value: FormDataEntryValue | undefined): string[] | undefined {
  const parsed = parseJsonField(value);
  if (!Array.isArray(parsed)) return undefined;
  return parsed.filter((v): v is string => typeof v === "string" && v.length > 0 && v.length <= 64);
}

// Keys handled explicitly; everything else submitted by the dynamic form is stored in customData.
const STANDARD_KEYS = new Set([
  "id", "title", "category", "date", "time", "location", "phone", "email", "package", "advance", "due",
  "status", "installments", "packageName", "inclusions", "notes", "attachments", "assigneeIds",
  "finishingStatus", "proofDelivered", "customData", "recordDate", "jobNumber",
]);
const MAX_CUSTOM_FIELDS = 200;
const MAX_CUSTOM_VALUE_LENGTH = 20000;

export async function saveJobAction(formData: FormData) {
  const user = await authorize("manage_jobs");
  if (isError(user)) return { success: false as const, errors: { _form: [user.error] } };

  try {
    const rawData = Object.fromEntries(formData.entries());
    const validated = jobSchema.parse(rawData);

    const customData: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(rawData)) {
      if (STANDARD_KEYS.has(key) || key.startsWith("$ACTION")) continue;
      if (typeof value !== "string") continue;
      if (Object.keys(customData).length >= MAX_CUSTOM_FIELDS) break;
      customData[key] = value.slice(0, MAX_CUSTOM_VALUE_LENGTH);
    }

    const installments = parseJsonField(rawData.installments);
    const result = await saveJob(
      {
        id: validated.id || undefined,
        jobNumber: typeof rawData.jobNumber === "string" ? rawData.jobNumber : undefined,
        client: { name: validated.title, phone: validated.phone, email: validated.email || null },
        category: validated.category,
        date: validated.date || undefined,
        recordDate: typeof rawData.recordDate === "string" ? rawData.recordDate : undefined,
        time: validated.time,
        location: validated.location,
        status: validated.status,
        packageAmount: parseAmount(validated.package),
        installments: Array.isArray(installments) ? (installments as InstallmentInput[]) : [],
        finishingStatus: validated.finishingStatus || undefined,
        proofDelivered:
          validated.proofDelivered === undefined
            ? undefined
            : validated.proofDelivered === true || validated.proofDelivered === "true",
        packageName: typeof rawData.packageName === "string" ? rawData.packageName : undefined,
        notes: typeof rawData.notes === "string" ? rawData.notes : undefined,
        inclusions: parseJsonField(rawData.inclusions),
        attachments: parseJsonField(rawData.attachments),
        assigneeIds: parseAssigneeIds(rawData.assigneeIds),
        customData,
      },
      user
    );

    notifyAssigned(
      { id: result.job.id, jobNumber: result.job.jobNumber, clientName: result.client.name },
      result.assignmentChanges.added,
      user.id
    );

    broadcastLater(
      result.created
        ? {
          title: "New Job Created",
          message: `A new Job (${result.job.jobNumber}) has been created for ${result.client.name}.`,
          type: "JOB_CREATED",
          actionUrl: `/jobs/details/${result.job.id}`,
          entityId: result.job.id,
          entityType: "job",
          skipUserId: user.id,
        }
        : {
          title: "Job Updated",
          message: `The job ${result.job.jobNumber || ""} has been updated.`,
          type: "JOB_UPDATED",
          actionUrl: `/jobs/details/${result.job.id}`,
          entityId: result.job.id,
          entityType: "job",
          skipUserId: user.id,
        }
    );

    revalidatePath("/jobs", "layout");
    revalidatePath("/dashboard", "layout");
    return {
      success: true as const,
      data: {
        ...validated,
        id: result.job.id,
        jobNumber: result.job.jobNumber,
        installments: JSON.stringify(result.installments),
        advance: String(result.order?.advance ?? 0),
        due: String(result.order?.due ?? 0),
      } as unknown as Job,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false as const, errors: z.flattenError(error).fieldErrors as Record<string, string[]> };
    }
    console.error("[saveJobAction]", error);
    const message = error instanceof HttpError ? error.message : "An unexpected error occurred while saving the job.";
    return { success: false as const, errors: { _form: [message] } };
  }
}

export async function deleteJobAction(id: string) {
  const user = await authorize("manage_jobs");
  if (isError(user)) return user;

  try {
    await assertJobVisible(id, user);
    const deleted = await softDeleteJob(id, user.id);
    if (!deleted) return { success: false, error: "Not found" };
    revalidatePath("/jobs", "layout");
    revalidatePath("/dashboard", "layout");
    return { success: true };
  } catch (e) {
    console.error("[deleteJobAction]", e);
    return { success: false, error: e instanceof HttpError ? e.message : "Failed to delete job" };
  }
}

function readCustomData(value: Prisma.JsonValue | null): Record<string, unknown> {
  if (typeof value === "string") {
    try {
      return JSON.parse(value) ?? {};
    } catch {
      return {};
    }
  }
  return value && typeof value === "object" && !Array.isArray(value) ? { ...(value as Record<string, unknown>) } : {};
}

export async function updateJobStatusAction(jobId: string, newStatus: string) {
  const user = await authorize("manage_jobs");
  if (isError(user)) return user;
  if (typeof newStatus !== "string" || !newStatus.trim() || newStatus.length > 100) {
    return { success: false, error: "Invalid status" };
  }

  try {
    const { job } = await updateJob(user, jobId, (existing) => {
      const customData = readCustomData(existing.customData);
      if (isProductionDone(newStatus)) {
        if (existing.status !== newStatus || !customData.fld_b_finishing_status) {
          customData.fld_b_finishing_status = "Pending";
        }
      } else {
        delete customData.fld_b_finishing_status;
      }
      return { status: newStatus, customData: customData as Prisma.InputJsonValue };
    });

    await prisma.systemLog.create({
      data: { userId: user.id, action: "JOB_STATUS_UPDATED", details: `Updated job ID: ${jobId} status to ${newStatus}` },
    });

    broadcastLater({
      title: "Job Status Changed",
      message: `Job ${job.jobNumber || ""} status has been updated to ${newStatus}.`,
      type: "JOB_UPDATED",
      actionUrl: `/jobs/details/${jobId}`,
      entityId: jobId,
      entityType: "job",
      skipUserId: user.id,
    });

    revalidatePath("/jobs", "layout");
    revalidatePath("/dashboard", "layout");
    return { success: true };
  } catch (e) {
    console.error("[updateJobStatusAction]", e);
    return { success: false, error: e instanceof HttpError ? e.message : "Failed to update job status" };
  }
}

const trackingSchema = z.object({
  status: z.string().trim().min(1).max(100).optional(),
  customData: z
    .record(z.string().max(100), z.unknown())
    .refine((v) => Object.keys(v).length <= 50, "Too many fields")
    .optional(),
});

export async function updateJobTrackingAction(jobId: string, updates: { status?: string; customData?: Record<string, unknown> }) {
  const user = await authorize("manage_jobs");
  if (isError(user)) return user;

  const parsed = trackingSchema.safeParse(updates);
  if (!parsed.success) return { success: false, error: "Invalid update" };

  try {
    await updateJob(user, jobId, (existing) => {
      const customData = { ...readCustomData(existing.customData), ...(parsed.data.customData ?? {}) };
      const data: Prisma.JobUncheckedUpdateInput = { customData: customData as Prisma.InputJsonValue };
      if (customData.fld_b_finishing_status === "Delivered") data.proofDelivered = true;
      if (parsed.data.status !== undefined) data.status = parsed.data.status;
      return data;
    });

    revalidatePath("/jobs", "layout");
    revalidatePath("/dashboard", "layout");
    return { success: true };
  } catch (e) {
    console.error("[updateJobTrackingAction]", e);
    return { success: false, error: e instanceof HttpError ? e.message : "Failed to update finishing tracking" };
  }
}

export async function generateInvoiceAction(jobId: string) {
  const user = await authorize("manage_transactions");
  if (isError(user)) return user;

  try {
    await assertJobVisible(jobId, user);
    const existingInvoice = await prisma.invoice.findFirst({ where: { jobId, deletedAt: undefined } });
    if (existingInvoice) {
      if (existingInvoice.deletedAt) {
        await prisma.invoice.update({ where: { id: existingInvoice.id }, data: { deletedAt: null } });
      }
      return { success: true, invoiceId: existingInvoice.id };
    }

    const job = await prisma.job.findUnique({ where: { id: jobId }, include: { order: true } });
    if (!job || job.deletedAt) return { success: false, error: "Job not found" };

    const invoice = await prisma.$transaction(async (tx) => {
      // Sequential, gap-free per counter row; never derived from a string sort of existing numbers.
      const n = await nextCounter(tx, "invoice");
      const amount = job.order?.package ?? 0;
      const invoiceNumber = `INV-${String(n).padStart(4, "0")}`;
      await recordJobActivity(tx, { jobId, actorId: user.id, type: "INVOICE_GENERATED", summary: `Generated invoice ${invoiceNumber}` });
      return tx.invoice.create({
        data: {
          jobId,
          invoiceNumber,
          discount: 0,
          lineItems: {
            create: [{ description: `${job.category || "Standard"} Package`, quantity: 1, rate: amount, amount }],
          },
        },
      });
    });

    return { success: true, invoiceId: invoice.id };
  } catch (e) {
    console.error("[generateInvoiceAction]", e);
    return { success: false, error: "Failed to generate invoice" };
  }
}
