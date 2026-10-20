"use server";

import { z } from "zod";
import { jobSchema } from "@/lib/validations/job";
import { Job } from "@/types";
import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { broadcastNotification } from "@/lib/notifications";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function saveJobAction(formData: FormData) {
  try {
    const session = await getServerSession(authOptions);
    const rawData = Object.fromEntries(formData.entries());
    const validatedData = jobSchema.parse(rawData);

    // Extract custom dynamic fields that are not part of the standard validatedData
    const standardKeys = ['id', 'title', 'category', 'date', 'time', 'location', 'phone', 'email', 'package', 'advance', 'due', 'status', 'installments', 'packageName', 'inclusions', 'notes', 'attachments', 'photographers', 'albumStatus', 'galleryDelivered'];
    const customData: Record<string, any> = {};
    for (const [key, value] of Object.entries(rawData)) {
      if (!standardKeys.includes(key) && key !== 'customData' && key !== 'recordDate' && !key.startsWith('$ACTION')) {
        customData[key] = value;
      }
    }

    // Logic to reset Album Status to Pending if Event Status changes to Shoot Completed
    // is now handled inside the existingJob check below for updates, and here for creations.
    if (!validatedData.id && (validatedData.status === 'Shoot Completed' || validatedData.status === 'Completed')) {
      customData.fld_b_album_status = 'Pending';
    }

    const recordDate = rawData.recordDate ? new Date(rawData.recordDate as string) : undefined;

    if (validatedData.id) {
      const existingJob = await prisma.job.findUnique({ where: { id: validatedData.id }, include: { client: true, order: true } });
      if (existingJob) {
        await prisma.client.update({
          where: { id: existingJob.clientId },
          data: { name: validatedData.title, phone: validatedData.phone || "", email: validatedData.email }
        });
        const isNewlyShootCompleted = (validatedData.status === 'Shoot Completed' || validatedData.status === 'Completed') &&
          (existingJob.status !== 'Shoot Completed' && existingJob.status !== 'Completed');

        if (isNewlyShootCompleted || ((validatedData.status === 'Shoot Completed' || validatedData.status === 'Completed') && !customData.fld_b_album_status)) {
          customData.fld_b_album_status = 'Pending';
        } else if (validatedData.status !== 'Shoot Completed' && validatedData.status !== 'Completed') {
          delete customData.fld_b_album_status;
        }

        await prisma.job.update({
          where: { id: validatedData.id },
          data: {
            category: validatedData.category,
            date: recordDate ? recordDate : (validatedData.date ? new Date(validatedData.date) : new Date()),
            time: validatedData.time || "",
            location: validatedData.location || "",
            status: validatedData.status,
            packageName: rawData.packageName ? String(rawData.packageName) : undefined,
            inclusions: rawData.inclusions ? JSON.parse(String(rawData.inclusions)) : undefined,
            notes: rawData.notes ? String(rawData.notes) : undefined,
            attachments: rawData.attachments ? JSON.parse(String(rawData.attachments)) : undefined,
            photographers: rawData.photographers ? JSON.parse(String(rawData.photographers)) : undefined,
            albumStatus: validatedData.albumStatus ? (validatedData.albumStatus.toUpperCase() as any) : undefined,
            galleryDelivered: validatedData.galleryDelivered !== undefined ? (validatedData.galleryDelivered === 'true' || validatedData.galleryDelivered === true) : undefined,
            customData: Object.keys(customData).length > 0 ? customData : undefined,
            ...((session?.user as any)?.id ? { updatedBy: { connect: { id: (session?.user as any)?.id } } } : {}),
          }
        });
        const pkg = parseFloat((validatedData.package || '0').toString().replace(/,/g, '')) || 0;
        const adv = parseFloat((validatedData.advance || '0').toString().replace(/,/g, '')) || 0;
        const due = parseFloat((validatedData.due || '0').toString().replace(/,/g, '')) || 0;
        let parsedInstallments = null;
        try {
          if (validatedData.installments) parsedInstallments = JSON.parse(validatedData.installments);
        } catch (e) { }

        if (existingJob.order) {
          await prisma.order.update({
            where: { jobId: validatedData.id },
            data: { package: pkg, advance: adv, due: due, installments: parsedInstallments }
          });
        } else {
          await prisma.order.create({
            data: { jobId: validatedData.id, package: pkg, advance: adv, due: due, installments: parsedInstallments }
          });
        }

        await prisma.systemLog.create({
          data: { action: "JOB_UPDATED", details: `Updated job ID: ${validatedData.id}` }
        });

        // Fire and forget notification to prevent blocking UI
        broadcastNotification({
          title: "Job Updated",
          message: `The job ${existingJob.jobNumber || ''} has been updated.`,
          type: "JOB_UPDATED",
          actionUrl: `/jobs/details/${validatedData.id}`,
          entityId: validatedData.id,
          entityType: "job",
          skipUserId: (session?.user as any)?.id
        }).catch(e => console.error("Notification error:", e));

        revalidatePath('/', 'layout');
        return { success: true, data: validatedData as Job };
      }
    }

    const client = await prisma.client.create({
      data: { name: validatedData.title, phone: validatedData.phone || "", email: validatedData.email }
    });

    let nextJobNumber = rawData.jobNumber as string;
    if (!nextJobNumber) {
      let isUnique = false;
      const crypto = require('crypto');
      while (!isUnique) {
        const suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
        nextJobNumber = `#MD-${suffix}`;

        const activeExists = await prisma.job.findFirst({
          where: { jobNumber: nextJobNumber }
        });

        if (!activeExists) {
          isUnique = true;
        }
      }
    }

    const newJob = await prisma.job.create({
      data: {
        id: validatedData.id || undefined,
        jobNumber: nextJobNumber,
        clientId: client.id,
        category: validatedData.category,
        date: recordDate ? recordDate : (validatedData.date ? new Date(validatedData.date) : new Date()),
        time: validatedData.time || "",
        location: validatedData.location || "",
        status: validatedData.status,
        packageName: rawData.packageName ? String(rawData.packageName) : undefined,
        inclusions: rawData.inclusions ? JSON.parse(String(rawData.inclusions)) : undefined,
        notes: rawData.notes ? String(rawData.notes) : undefined,
        attachments: rawData.attachments ? JSON.parse(String(rawData.attachments)) : undefined,
        photographers: rawData.photographers ? JSON.parse(String(rawData.photographers)) : undefined,
        albumStatus: validatedData.albumStatus ? (validatedData.albumStatus.toUpperCase() as any) : undefined,
        galleryDelivered: validatedData.galleryDelivered !== undefined ? (validatedData.galleryDelivered === 'true' || validatedData.galleryDelivered === true) : undefined,
        customData: Object.keys(customData).length > 0 ? customData : undefined,
        createdById: (session?.user as any)?.id || undefined,
        updatedById: (session?.user as any)?.id || undefined,
      }
    });

    const pkg = parseFloat((validatedData.package || '0').toString().replace(/,/g, '')) || 0;
    const adv = parseFloat((validatedData.advance || '0').toString().replace(/,/g, '')) || 0;
    const due = parseFloat((validatedData.due || '0').toString().replace(/,/g, '')) || 0;
    let parsedInstallments = null;
    try {
      if (validatedData.installments) parsedInstallments = JSON.parse(validatedData.installments);
    } catch (e) { }

    await prisma.order.create({
      data: {
        jobId: newJob.id,
        package: pkg,
        advance: adv,
        due: due,
        installments: parsedInstallments
      }
    });

    await prisma.systemLog.create({
      data: { action: "JOB_CREATED", details: `Created job ID: ${newJob.id} for client ${client.name}` }
    });

    // Fire and forget notification to prevent blocking UI
    broadcastNotification({
      title: "New Job Created",
      message: `A new Job (${nextJobNumber}) has been created for ${validatedData.title}.`,
      type: "JOB_CREATED",
      actionUrl: `/jobs/details/${newJob.id}`,
      entityId: newJob.id,
      entityType: "Job",
      skipUserId: (session?.user as any)?.id
    }).catch(e => console.error("Notification error:", e));

    revalidatePath('/', 'layout');

    return {
      success: true,
      data: { ...validatedData, id: newJob.id } as Job
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, errors: error.flatten().fieldErrors };
    }
    return { success: false, errors: { _form: [error instanceof Error ? error.message : "An unexpected error occurred while saving the job."] } };
  }
}

export async function deleteJobAction(id: string) {
  try {
    const session = await getServerSession(authOptions);
    const existing = await prisma.job.findUnique({ where: { id } });
    if (!existing) return { success: false, error: "Not found" };

    await prisma.job.update({
      where: { id },
      data: { deletedAt: new Date() }
    });

    await prisma.recycleBin.create({
      data: {
        itemType: "job",
        itemId: id,
        originalData: JSON.parse(JSON.stringify(existing)),
        trashedById: (session?.user as any)?.id || "System",
      }
    });

    await prisma.systemLog.create({
      data: { action: "JOB_SOFT_DELETED", details: `Soft deleted job ID: ${id}` }
    });

    revalidatePath('/', 'layout');
    return { success: true };
  } catch (e) {
    return { success: false, error: "Failed to delete job" };
  }
}

export async function updateJobStatusAction(jobId: string, newStatus: string) {
  try {
    const session = await getServerSession(authOptions);
    const existing = await prisma.job.findUnique({ where: { id: jobId } });
    if (!existing) return { success: false, error: 'Not found' };

    const dataToUpdate: any = { status: newStatus };
    if (newStatus === 'Shoot Completed' || newStatus === 'Completed') {
      let customData = existing.customData as Record<string, any>;
      if (typeof customData === 'string') {
        try { customData = JSON.parse(customData); } catch (e) { customData = {}; }
      } else {
        customData = customData || {};
      }

      if (existing.status !== newStatus || !customData.fld_b_album_status) {
        dataToUpdate.customData = { ...customData, fld_b_album_status: 'Pending' };
      }
    } else {
      let customData = existing.customData as Record<string, any>;
      if (typeof customData === 'string') {
        try { customData = JSON.parse(customData); } catch (e) { customData = {}; }
      } else {
        customData = customData || {};
      }

      if (customData.fld_b_album_status) {
        delete customData.fld_b_album_status;
        dataToUpdate.customData = customData;
      }
    }
    const job = await prisma.job.update({
      where: { id: jobId },
      data: dataToUpdate
    });

    await prisma.systemLog.create({
      data: { action: "JOB_STATUS_UPDATED", details: `Updated job ID: ${jobId} status to ${newStatus}` }
    });

    // Fire and forget notification to prevent blocking UI
    broadcastNotification({
      title: "Job Status Changed",
      message: `Job ${job.jobNumber || ''} status has been updated to ${newStatus}.`,
      type: "JOB_UPDATED",
      actionUrl: `/jobs/details/${jobId}`,
      entityId: jobId,
      entityType: "job",
      skipUserId: (session?.user as any)?.id
    }).catch(e => console.error("Notification error:", e));

    revalidatePath('/', 'layout');
    return { success: true };
  } catch (e) {
    return { success: false, error: "Failed to update job status" };
  }
}

export async function updateJobTrackingAction(jobId: string, updates: { status?: string, customData?: any }) {
  try {
    const session = await getServerSession(authOptions);
    const existing = await prisma.job.findUnique({ where: { id: jobId } });
    if (!existing) return { success: false, error: 'Not found' };

    let newCustomData = existing.customData as Record<string, any>;
    if (typeof newCustomData === 'string') {
      try { newCustomData = JSON.parse(newCustomData); } catch (e) { newCustomData = {}; }
    } else {
      newCustomData = newCustomData || {};
    }

    if (updates.customData) {
      newCustomData = { ...newCustomData, ...updates.customData };
    }

    const dataToUpdate: any = { customData: newCustomData };
    if (newCustomData.fld_b_album_status === 'Delivered') {
      dataToUpdate.galleryDelivered = true;
    }
    if (updates.status !== undefined) dataToUpdate.status = updates.status;
    if ((session?.user as any)?.id) dataToUpdate.updatedById = (session?.user as any)?.id;

    await prisma.job.update({
      where: { id: jobId },
      data: dataToUpdate
    });

    revalidatePath('/', 'layout');
    return { success: true };
  } catch (e) {
    return { success: false, error: "Failed to update album tracking" };
  }
}

export async function generateInvoiceAction(jobId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { success: false, error: 'Unauthorized' };

  const userRole = (session.user as any).role || 'STAFF';
  const permission = await prisma.rolePermission.findUnique({
    where: { role_permission: { role: userRole, permission: 'manage_transactions' } }
  });

  if (!permission?.enabled && userRole !== 'ADMIN') {
    return { success: false, error: 'Permission denied' };
  }

  const existingInvoice = await prisma.invoice.findUnique({
    where: { jobId }
  });

  if (existingInvoice) {
    return { success: true, invoiceId: existingInvoice.id };
  }

  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: { order: true }
  });

  if (!job) {
    return { success: false, error: 'Job not found' };
  }

  // Generate sequential INV-XXXX with retry logic for race conditions
  let invoiceId = null;
  let attempt = 0;

  while (attempt < 5) {
    try {
      const lastInvoice = await prisma.invoice.findFirst({
        orderBy: { invoiceNumber: 'desc' }
      });

      let nextNum = 1;
      if (lastInvoice && lastInvoice.invoiceNumber.startsWith('INV-')) {
        const numPart = parseInt(lastInvoice.invoiceNumber.replace('INV-', ''), 10);
        if (!isNaN(numPart)) {
          nextNum = numPart + 1;
        }
      }
      const invoiceNumber = `INV-${String(nextNum).padStart(4, '0')}`;

      const newInvoice = await prisma.invoice.create({
        data: {
          jobId,
          invoiceNumber,
          discount: 0,
          lineItems: {
            create: [
              {
                description: `${job.category || 'Standard'} Package`,
                quantity: 1,
                rate: job.order?.package || 0,
                amount: job.order?.package || 0
              }
            ]
          }
        }
      });
      invoiceId = newInvoice.id;
      break;
    } catch (e: any) {
      if (e.code === 'P2002') { // Prisma unique constraint violation
        attempt++;
        continue;
      }
      throw e;
    }
  }

  if (!invoiceId) {
    return { success: false, error: 'Failed to generate unique invoice number after multiple attempts' };
  }

  return { success: true, invoiceId };
}
