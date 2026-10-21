import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { intParam, notFound, route } from "@/lib/api/http";
import { requireAdmin } from "@/lib/auth/session";

/** Job activity stream, newest first, cursor-paginated. Admin only. */
export const GET = route<{ id: string }>(async (req, { params }) => {
  await requireAdmin();
  const { id } = await params;
  const url = new URL(req.url);
  const limit = intParam(url, "limit", 50, 1, 100);
  const cursor = url.searchParams.get("cursor");

  // Trashed jobs keep their history visible to admins.
  const job = await prisma.job.findFirst({ where: { id, deletedAt: undefined }, select: { id: true } });
  if (!job) throw notFound("Job not found");

  const rows = await prisma.jobActivity.findMany({
    where: { jobId: id },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      type: true,
      summary: true,
      changes: true,
      createdAt: true,
      actor: { select: { id: true, name: true, email: true, image: true } },
    },
  });

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  return NextResponse.json(
    { items, nextCursor: hasMore ? items[items.length - 1].id : null },
    { headers: { "Cache-Control": "private, no-store" } }
  );
});
