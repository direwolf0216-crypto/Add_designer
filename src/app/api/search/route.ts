import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { route } from "@/lib/api/http";
import { requireUser, roleHasPermission } from "@/lib/auth/session";
import { toBusinessISODate } from "@/lib/dates";
import { jobScope } from "@/lib/jobs/scope";
import { transactionJobScope } from "@/lib/jobs/scope";

const MAX_QUERY_LENGTH = 100;
const RESULTS_PER_TYPE = 5;

type SearchResult = {
  id: string;
  type: "JOB" | "TRANSACTION";
  title: string;
  subtitle: string;
  link: string;
  icon: string;
  color: string;
};

export const GET = route(async (request) => {
  const user = await requireUser();
  const scope = await jobScope(user);
  const query = (new URL(request.url).searchParams.get("q") ?? "").trim().slice(0, MAX_QUERY_LENGTH);
  if (query.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const contains = { contains: query, mode: "insensitive" as const };
  const canSeeTransactions = await roleHasPermission(user.role, "view_transactions");

  const [jobs, transactions] = await Promise.all([
    prisma.job.findMany({
      where: { ...scope,
        deletedAt: null,
        OR: [
          { jobNumber: contains },
          { location: contains },
          { client: { name: contains } },
          { client: { email: contains } },
          { client: { phone: contains } },
        ],
      },
      select: { id: true, category: true, jobNumber: true, date: true, client: { select: { name: true } } },
      orderBy: { date: "desc" },
      take: RESULTS_PER_TYPE,
    }),
    canSeeTransactions
      ? prisma.transaction.findMany({
          where: {
            deletedAt: null,
            OR: [{ description: contains }, { category: contains }, { transactionId: contains }],
            AND: [await transactionJobScope(user)],
          },
          select: { id: true, description: true, category: true, transactionId: true, type: true, amount: true, date: true },
          orderBy: { date: "desc" },
          take: RESULTS_PER_TYPE,
        })
      : Promise.resolve([]),
  ]);

  const results: SearchResult[] = [
    ...jobs.map((b) => ({
      id: b.id,
      type: "JOB" as const,
      title: `${b.client.name} - ${b.category}`,
      subtitle: `Job No: ${b.jobNumber || "N/A"} • ${toBusinessISODate(b.date)}`,
      link: `/jobs/details/${b.id}`,
      icon: "ph-calendar-star",
      color: "blue",
    })),
    ...transactions.map((t) => ({
      id: t.id,
      type: "TRANSACTION" as const,
      title: t.description || t.category,
      subtitle: `${t.transactionId ?? "-"} • ${t.type === "INCOME" ? "+" : "-"}₹${t.amount} • ${toBusinessISODate(t.date)}`,
      link: `/transactions/details/${t.id}`,
      icon: "ph-wallet",
      color: t.type === "INCOME" ? "green" : "red",
    })),
  ];

  return NextResponse.json({ results });
});
