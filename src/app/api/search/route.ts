import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || "";

    if (!query || query.length < 2) {
      return NextResponse.json({ results: [] });
    }

    const results: any[] = [];

    // Search Jobs (and associated Client)
    const jobs = await prisma.job.findMany({
      where: {
        deletedAt: null,
        OR: [
          { jobNumber: { contains: query, mode: "insensitive" } },
          { location: { contains: query, mode: "insensitive" } },
          { client: { name: { contains: query, mode: "insensitive" } } },
          { client: { email: { contains: query, mode: "insensitive" } } },
          { client: { phone: { contains: query, mode: "insensitive" } } },
        ]
      },
      include: {
        client: true
      },
      take: 5
    });

    jobs.forEach(b => {
      results.push({
        id: b.id,
        type: "JOB",
        title: `${b.client.name} - ${b.category}`,
        subtitle: `Job No: ${b.jobNumber || 'N/A'} • ${b.date.toISOString().split('T')[0]}`,
        link: `/jobs/details/${b.id}`,
        icon: "ph-calendar-star",
        color: "blue"
      });
    });

    // Search Transactions
    const transactions = await prisma.transaction.findMany({
      where: {
        OR: [
          { description: { contains: query, mode: "insensitive" } },
          { category: { contains: query, mode: "insensitive" } },
          { transactionId: { contains: query, mode: "insensitive" } },
        ]
      },
      take: 5
    });

    transactions.forEach(t => {
      results.push({
        id: t.id,
        type: "TRANSACTION",
        title: t.description || t.category,
        subtitle: `${t.transactionId} • ${t.type === 'INCOME' ? '+' : '-'}₹${t.amount} • ${t.date.toISOString().split('T')[0]}`,
        link: `/transactions/details/${t.id}`,
        icon: "ph-wallet",
        color: t.type === 'INCOME' ? "green" : "red"
      });
    });

    return NextResponse.json({ results });
  } catch (error) {
    return NextResponse.json({ error: "Failed to search" }, { status: 500 });
  }
}
