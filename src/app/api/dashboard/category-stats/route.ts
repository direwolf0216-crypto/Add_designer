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

    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);

    const jobs = await prisma.job.findMany({
      where: {
        deletedAt: null,
        status: { notIn: ['Cancelled', 'cancelled'] }
      },
      select: {
        id: true,
        status: true,
        createdAt: true,
        customData: true,
        order: {
          select: {
            package: true
          }
        }
      }
    });

    const categoryStats: Record<string, { activeJobs: number, pendingDelivery: number, monthlyRevenue: number }> = {};

    for (const job of jobs) {
      let customData: any = {};
      if (job.customData) {
        customData = typeof job.customData === 'string' ? JSON.parse(job.customData) : job.customData;
      }
      
      const category = customData?.fld_b_job_category;
      if (!category) continue;

      if (!categoryStats[category]) {
        categoryStats[category] = { activeJobs: 0, pendingDelivery: 0, monthlyRevenue: 0 };
      }

      const status = job.status?.toLowerCase() || '';

      // Count Active Jobs (not delivered, not cancelled)
      if (status !== 'delivered' && status !== 'cancelled') {
        categoryStats[category].activeJobs += 1;
      }

      // Count Pending Delivery (ready for delivery)
      if (status === 'ready for delivery') {
        categoryStats[category].pendingDelivery += 1;
      }

      // Sum Revenue for current month
      const jobDate = new Date(job.createdAt);
      if (jobDate >= startOfMonth && jobDate <= endOfMonth) {
        if (job.order && job.order.package) {
          categoryStats[category].monthlyRevenue += Number(job.order.package) || 0;
        }
      }
    }

    const result = Object.entries(categoryStats).map(([category, stats]) => ({
      category,
      activeJobs: stats.activeJobs,
      pendingDelivery: stats.pendingDelivery,
      monthlyRevenue: stats.monthlyRevenue
    }));

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error fetching category stats:', error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
