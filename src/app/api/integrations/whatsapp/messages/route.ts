import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { intParam, route } from "@/lib/api/http";
import { requireAdmin } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/** Recent WhatsApp messages (both directions) for the Settings log. */
export const GET = route(async (req) => {
  await requireAdmin();
  const url = new URL(req.url);
  const limit = intParam(url, "limit", 30, 1, 100);
  const jobId = url.searchParams.get("jobId") || undefined;
  const rows = await prisma.whatsAppMessage.findMany({ where: jobId ? { jobId } : undefined, orderBy: { createdAt: "desc" }, take: limit });
  const jobIds = [...new Set(rows.map((r) => r.jobId).filter((id): id is string => !!id))];
  const jobs = jobIds.length ? await prisma.job.findMany({ where: { id: { in: jobIds } }, select: { id: true, jobNumber: true, client: { select: { name: true } } } }) : [];
  const jobById = new Map(jobs.map((j) => [j.id, j]));
  return NextResponse.json({
    messages: rows.map((r) => ({ ...r, job: r.jobId ? jobById.get(r.jobId) ?? null : null })),
  });
});
