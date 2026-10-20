import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const { searchParams } = new URL(req.url);
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');

    const today = new Date();
    
    let startDate, endDate;
    if (startDateParam && endDateParam) {
      startDate = new Date(startDateParam);
      endDate = new Date(endDateParam);
    } else {
      startDate = new Date(today.getFullYear(), today.getMonth(), 1);
      endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
    }
    
    const startOfDay = new Date(startDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(endDate);
    endOfDay.setHours(23, 59, 59, 999);

    const ninetyDaysFromNow = new Date(today);
    ninetyDaysFromNow.setDate(today.getDate() + 90);

    const [
      totalJobs,
      upcomingShoots,
      pendingRetouch,
      activeOrders,
      totalActiveOrders,
      unconfirmedJobsCount,
      prefsDoc
    ] = await Promise.all([
      prisma.job.count({
        where: { deletedAt: null, status: { notIn: ['Cancelled', 'cancelled'] }, date: { gte: startOfDay, lte: endOfDay } }
      }),
      prisma.job.findMany({
        where: { deletedAt: null, date: { gte: today } },
        select: {
          id: true,
          date: true,
          time: true,
          location: true,
          status: true,
          customData: true,
          client: { select: { name: true, phone: true } },
          order: { select: { package: true } },
        },
        orderBy: { date: 'asc' },
        take: 3
      }),
      prisma.productOrder.count({
        where: { status: 'READY_FOR_PICKUP' }
      }),
      prisma.productOrder.findMany({
        where: { status: { not: 'DELIVERED' } },
        select: {
          id: true,
          quantity: true,
          status: true,
          clientName: true,
          product: { select: { name: true, price: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 1
      }),
      prisma.productOrder.count({
        where: { status: { not: 'DELIVERED' } }
      }),
      prisma.job.count({
        where: { deletedAt: null, status: { in: ['Pending', 'pending'] }, date: { gte: startOfDay, lte: endOfDay } }
      }),
      prisma.systemSetting.findUnique({
        where: { key: 'UI_PREFERENCES' }
      })
    ]);

    const [transactions, allPeriodTransactions, typeAgg, jobsForChart, upcomingAllJobs] = await Promise.all([
      prisma.transaction.findMany({
        where: { date: { gte: startOfDay, lte: endOfDay }, deletedAt: null },
        orderBy: { date: 'desc' },
        take: 10,
        select: { id: true, transactionId: true, amount: true, type: true, category: true, paymentMode: true, description: true, date: true },
      }),
      prisma.transaction.findMany({
        where: { date: { gte: startOfDay, lte: endOfDay }, deletedAt: null },
        select: { amount: true, type: true, date: true }
      }),
      prisma.transaction.groupBy({
        by: ['type'],
        _sum: { amount: true },
        where: { date: { gte: startOfDay, lte: endOfDay }, deletedAt: null }
      }),
      prisma.job.findMany({
        where: { 
          deletedAt: null,
          status: { notIn: ['Delivered', 'delivered', 'Cancelled', 'cancelled'] }
        },
        select: { id: true, date: true, status: true, category: true, customData: true, client: { select: { name: true } } }
      }),
      prisma.job.findMany({
        where: { deletedAt: null, date: { gte: today, lte: ninetyDaysFromNow } },
        select: { date: true, order: { select: { package: true } } }
      })
    ]);

    const incomeItem = typeAgg.find(t => t.type === 'INCOME');
    const expenseItem = typeAgg.find(t => t.type === 'EXPENSE');
    const periodIncome = incomeItem?._sum.amount || 0;
    const periodExpense = expenseItem?._sum.amount || 0;

    const dailyDataMap: Record<string, { date: string, income: number, expense: number }> = {};
    const curr = new Date(startOfDay);
    while (curr <= endOfDay) {
      const dateStr = curr.toISOString().split('T')[0];
      dailyDataMap[dateStr] = { date: dateStr, income: 0, expense: 0 };
      curr.setDate(curr.getDate() + 1);
    }

    allPeriodTransactions.forEach(tx => {
      const dateStr = tx.date.toISOString().split('T')[0];
      if (dailyDataMap[dateStr]) {
        if (tx.type === 'INCOME') dailyDataMap[dateStr].income += tx.amount;
        if (tx.type === 'EXPENSE') dailyDataMap[dateStr].expense += tx.amount;
      }
    });

    const revenueChartData = Object.values(dailyDataMap).sort((a, b) => a.date.localeCompare(b.date));

    const pendingAlbumsRaw: any[] = [];
    jobsForChart.forEach(b => {
      let cd: any = {};
      if (b.customData) {
        cd = typeof b.customData === 'string' ? JSON.parse(b.customData) : b.customData;
      }
      
      const isAlbum = b.category === 'Album' || 
                     cd?.fld_b_inclusions?.includes('Album') || 
                     cd?.album_status ||
                     cd?.fld_b_album_status;
      const bStatus = (b.status || '').trim().toLowerCase();
      
      const qualifiesAsAlbum = isAlbum || ['shoot completed', 'designing', 'printing', 'album work in progress'].includes(bStatus);
      
      if (qualifiesAsAlbum) {
        const albumStatus = cd?.fld_b_album_status || 'Pending';
        if (albumStatus !== 'Delivered') {
          pendingAlbumsRaw.push({
            id: b.id,
            clientName: (b.client as any)?.name || 'Unknown',
            status: albumStatus,
            date: b.date
          });
        }
      }
    });

    pendingAlbumsRaw.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const jobBreakdownData = pendingAlbumsRaw.slice(0, 5);

    const prefs = prefsDoc?.value as any || {};
    const hotDateBenchmark = prefs.hotDateBenchmark ?? prefs.hotDateThreshold ?? 50000;

    const dateSums: Record<string, number> = {};
    for (const b of upcomingAllJobs) {
      if (!b.date) continue;
      const dateStr = b.date.toISOString().split('T')[0];
      dateSums[dateStr] = (dateSums[dateStr] || 0) + (b.order?.package || 0);
    }
    const hotDatesCount = Object.values(dateSums).filter(sum => sum >= hotDateBenchmark).length;

    return NextResponse.json({
      totalJobs,
      upcomingShoots,
      pendingRetouch,
      topOrder: activeOrders[0] || null,
      totalActiveOrders,
      transactions,
      periodIncome,
      periodExpense,
      periodNet: periodIncome - periodExpense,
      hotDatesCount,
      revenueChartData,
      jobBreakdownData,
      unconfirmedJobsCount
    });

  } catch (error) {
    console.error("Dashboard API Error:", error);
    return NextResponse.json({ error: "Failed to fetch dashboard data" }, { status: 500 });
  }
}
