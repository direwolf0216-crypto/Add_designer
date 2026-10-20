import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    
    // In production, require CRON_SECRET. In development, allow bypass for testing if secret isn't set.
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Calculate exactly tomorrow's date range (start of day to end of day)
    const now = new Date();
    const tomorrowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const tomorrowEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2);

    const upcomingJobs = await prisma.job.findMany({
      where: {
        date: {
          gte: tomorrowStart,
          lt: tomorrowEnd,
        },
        status: {
          not: "Cancelled", // Don't remind about cancelled shoots
        },
      },
      include: {
        client: true,
      },
    });

    if (upcomingJobs.length === 0) {
      return NextResponse.json({ success: true, message: "No jobs for tomorrow." });
    }

    // Get admins as fallback
    const admins = await prisma.user.findMany({
      where: { role: "ADMIN", status: "ACTIVE" },
      select: { id: true },
    });

    let notificationsSent = 0;

    for (const job of upcomingJobs) {
      const photographers = Array.isArray(job.photographers) ? job.photographers : [];
      let recipients: string[] = [];

      // If photographers are assigned, notify them. Otherwise, notify admins.
      if (photographers.length > 0) {
        recipients = photographers.map((p: any) => p.id || p);
      } else {
        recipients = admins.map((admin) => admin.id);
      }

      const bNo = job.jobNumber || job.id.substring(0, 8);
      const title = `Shoot Tomorrow!`;
      const message = `Reminder: ${job.category} shoot for ${job.client.name} is scheduled for tomorrow at ${job.location || 'TBD'}.`;

      for (const userId of recipients) {
        if (typeof userId === "string") {
          await createNotification({
            userId,
            title,
            message,
            type: "HOT_DATE_ALERT",
            actionUrl: `/jobs/details/${job.id}`,
            entityId: job.id,
            entityType: "job",
            priority: "HIGH"
          });
          notificationsSent++;
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: `Sent ${notificationsSent} reminders for ${upcomingJobs.length} jobs.` 
    });

  } catch (error) {
    return NextResponse.json(
      { error: "Failed to run cron job" },
      { status: 500 }
    );
  }
}
