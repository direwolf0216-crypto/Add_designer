import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { broadcastNotification } from "@/lib/notifications";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const id = (await params).id;
    const job = await prisma.job.findUnique({
      where: { id },
      include: {
        client: true,
        order: true,
        transactions: true,
        createdBy: { select: { name: true, email: true } },
        updatedBy: { select: { name: true, email: true } },
      },
    });

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    return NextResponse.json(job, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch job" }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const id = (await params).id;
    const body = await request.json();
    const { category, date, time, location, status, galleryUrl, contractUrl, customData, packageName, inclusions, notes, attachments, photographers } = body;

    const updated = await prisma.job.update({
      where: { id },
      data: {
        category,
        date: date ? new Date(date) : undefined,
        time,
        location,
        status,
        galleryUrl,
        contractUrl,
        customData,
        packageName,
        inclusions,
        notes,
        attachments,
        photographers,
        ...( (session?.user as any)?.id ? { updatedBy: { connect: { id: (session?.user as any)?.id } } } : {} ),
      },
    });

    await prisma.systemLog.create({
      data: {
        action: "JOB_UPDATED",
        details: `Updated job ID: ${updated.id} via API`,
        userId: (session.user as any).id,
      }
    });

    // Notify admins about the update
      // Fire and forget
      broadcastNotification({
        title: "Job Status Update",
        message: `Job ${updated.jobNumber || `#${updated.id.substring(0, 8)}`} status changed to ${status}.`,
        type: "JOB_UPDATED",
        actionUrl: `/jobs/details/${updated.id}`,
        entityId: updated.id,
        entityType: "job",
        skipUserId: (session?.user as any)?.id
      }).catch(console.error);

    return NextResponse.json(updated, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to update job" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const id = (await params).id;
    const { searchParams } = new URL(request.url);
    const hardDelete = searchParams.get("hard") === "true";

    if (hardDelete) {
      await prisma.job.delete({
        where: { id },
      });
      await prisma.systemLog.create({
        data: {
          action: "JOB_HARD_DELETED",
          details: `Hard deleted job ID: ${id} via API`,
          userId: (session.user as any).id,
        }
      });
    } else {
      const existing = await prisma.job.findUnique({ where: { id } });
      if (existing) {
        await prisma.job.update({
          where: { id },
          data: { deletedAt: new Date() },
        });

        // Delete associated transactions first to prevent foreign key constraint failures
        const txDeleteResult = await prisma.transaction.deleteMany({
          where: { jobId: id }
        });
        await prisma.recycleBin.create({
          data: {
            itemType: "job",
            itemId: id,
            originalData: existing as any,
            trashedById: (session.user as any).id,
          }
        });
      }
      await prisma.systemLog.create({
        data: {
          action: "JOB_SOFT_DELETED",
          details: `Soft deleted job ID: ${id} via API`,
          userId: (session.user as any).id,
        }
      });
    }

    return NextResponse.json({ success: true }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete job" }, { status: 500 });
  }
}
