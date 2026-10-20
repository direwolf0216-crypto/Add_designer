import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    // Basic auth check for cron jobs (Vercel uses a header)
    const authHeader = request.headers.get('authorization');
    if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new NextResponse('Forbidden', { status: 403 });
    }

    // 1. Fetch thresholds
    const settings = await prisma.systemSetting.findMany({
      where: {
        key: {
          in: [
            'reminder_threshold_order_stale',
            'reminder_threshold_order_ready',
            'reminder_threshold_advance',
            'reminder_threshold_gallery',
            'reminder_threshold_album',
            'reminder_threshold_payment_due',
          ]
        }
      }
    });

    const getThreshold = (key: string, defaultValue: number) => {
      const setting = settings.find(s => s.key === key);
      if (setting && typeof setting.value === 'object' && setting.value !== null && 'days' in setting.value) {
        return Number((setting.value as any).days);
      }
      return defaultValue;
    };

    const thresholds = {
      orderStale: getThreshold('reminder_threshold_order_stale', 3),
      orderReady: getThreshold('reminder_threshold_order_ready', 2),
      advance: getThreshold('reminder_threshold_advance', 7),
      gallery: getThreshold('reminder_threshold_gallery', 14),
      album: getThreshold('reminder_threshold_album', 30),
      paymentDue: getThreshold('reminder_threshold_payment_due', 3),
    };

    const now = new Date();
    let notificationsCreated = 0;

    // Duplicate reminder check: skip if same entityId + type notification exists with createdAt > now() - 24h OR snoozedUntil > now()
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - 24);

    const existingReminders = await prisma.notification.findMany({
      where: {
        type: {
          in: [
            'ORDER_STATUS_STALE',
            'JOB_STATUS_STALE',
            'PAYMENT_DUE_REMINDER',
            'ADVANCE_NOT_COLLECTED',
            'GALLERY_NOT_DELIVERED',
            'ALBUM_PENDING_REMINDER'
          ]
        },
        OR: [
          { createdAt: { gt: cutoffDate } },
          { snoozedUntil: { gt: now } }
        ]
      },
      select: { entityId: true, type: true }
    });

    const activeReminderSet = new Set();
    for (const r of existingReminders) {
      activeReminderSet.add(`${r.type}_${r.entityId}`);
    }

    const admins = await prisma.user.findMany({ where: { role: 'ADMIN' }, select: { id: true } });
    const adminIds = admins.map(a => a.id);

    const createReminders = async (type: any, entityId: string, title: string, message: string, actionUrl: string) => {
      if (activeReminderSet.has(`${type}_${entityId}`)) return; // Already have an active/snoozed reminder
      
      const newNotifs = adminIds.map(userId => ({
        userId,
        type,
        title,
        message,
        actionUrl,
        entityId,
        entityType: type.startsWith('ORDER') ? 'order' : 'job',
        priority: 'HIGH',
      }));

      if (newNotifs.length > 0) {
        await prisma.notification.createMany({ data: newNotifs });
        notificationsCreated += newNotifs.length;
      }
    };


    // 4. Jobs missing advance payments (event < 7 days)
    const upcomingEventDate = new Date();
    upcomingEventDate.setDate(upcomingEventDate.getDate() + thresholds.advance);

    const advanceMissingJobs = await prisma.job.findMany({
      where: {
        date: { gte: now, lte: upcomingEventDate },
        deletedAt: null,
        status: 'Confirmed',
        order: {
          advance: 0
        }
      },
      include: { client: true }
    });

    for (const job of advanceMissingJobs) {
      await createReminders(
        'ADVANCE_NOT_COLLECTED',
        job.id,
        `Advance Missing`,
        `No advance collected for ${job.client?.name} shoot on ${job.date.toISOString().split('T')[0]}.`,
        `/jobs/details/${job.id}`
      );
    }

    // 5. Jobs COMPLETED with galleryDelivered = false > 14 days
    const galleryDate = new Date();
    galleryDate.setDate(galleryDate.getDate() - thresholds.gallery);

    const galleryPendingJobsRaw = await prisma.job.findMany({
      where: {
        date: { lt: galleryDate },
        deletedAt: null,
      },
      include: { client: true }
    });

    const galleryPendingJobs = galleryPendingJobsRaw.filter(b => {
      let cd: any = {};
      try { cd = typeof b.customData === 'string' ? JSON.parse(b.customData) : (b.customData || {}); } catch(e) {}
      return cd.fld_b_album_status !== 'Delivered';
    });

    for (const job of galleryPendingJobs) {
      await createReminders(
        'GALLERY_NOT_DELIVERED',
        job.id,
        `Gallery Pending`,
        `Gallery not delivered for ${job.client?.name} (event was ${thresholds.gallery}+ days ago).`,
        `/jobs/details/${job.id}`
      );
    }

    // 6. Jobs with album status PENDING > 30 days
    const albumDate = new Date();
    albumDate.setDate(albumDate.getDate() - thresholds.album);

    const albumPendingJobsRaw = await prisma.job.findMany({
      where: {
        date: { lt: albumDate },
        deletedAt: null,
      },
      include: { client: true }
    });

    const albumPendingJobs = albumPendingJobsRaw.filter(b => {
      let cd: any = {};
      try { cd = typeof b.customData === 'string' ? JSON.parse(b.customData) : (b.customData || {}); } catch(e) {}
      return cd.fld_b_album_status === 'Pending';
    });

    for (const job of albumPendingJobs) {
      await createReminders(
        'ALBUM_PENDING_REMINDER',
        job.id,
        `Album Pending`,
        `Album status still PENDING for ${job.client?.name} (event was ${thresholds.album}+ days ago).`,
        `/jobs/details/${job.id}`
      );
    }

    // 7. Payment dues approaching (Due < 3 days with dueAmount > 0)
    // For Jobs
    const paymentDueDate = new Date();
    paymentDueDate.setDate(paymentDueDate.getDate() + thresholds.paymentDue);

    const dueJobs = await prisma.job.findMany({
      where: {
        date: { gte: now, lte: paymentDueDate },
        deletedAt: null,
        order: {
          due: { gt: 0 }
        }
      },
      include: { client: true, order: true }
    });

    for (const job of dueJobs) {
      await createReminders(
        'PAYMENT_DUE_REMINDER',
        job.id,
        `Payment Due Soon`,
        `₹${job.order?.due} due for ${job.client?.name}'s shoot on ${job.date.toISOString().split('T')[0]}.`,
        `/jobs/details/${job.id}`
      );
    }



    return NextResponse.json({ success: true, notificationsCreated });
  } catch (error: any) {
    console.error('Reminder Cron Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
