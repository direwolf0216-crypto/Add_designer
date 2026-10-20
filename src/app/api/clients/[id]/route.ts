import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { conflict, notFound, parseJson, route } from "@/lib/api/http";
import { requireAdmin, requirePermission, requireUser } from "@/lib/auth/session";

const updateSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  phone: z.string().trim().min(1).max(30).optional(),
  email: z
    .union([z.email().max(200), z.literal("")])
    .nullish()
    .transform((v) => (v === undefined ? undefined : v || null)),
});

export const GET = route<{ id: string }>(async (_req, { params }) => {
  await requireUser();
  const { id } = await params;

  const client = await prisma.client.findUnique({
    where: { id },
    include: { jobs: { where: { deletedAt: null }, orderBy: { date: "desc" }, take: 500 } },
  });
  if (!client) throw notFound("Client not found");

  return NextResponse.json(client, { headers: { "Cache-Control": "private, no-store" } });
});

export const PUT = route<{ id: string }>(async (req, { params }) => {
  await requirePermission("manage_jobs");
  const { id } = await params;
  const data = await parseJson(req, updateSchema);

  const updated = await prisma.client.update({ where: { id }, data });

  return NextResponse.json(updated, { headers: { "Cache-Control": "private, no-store" } });
});

export const DELETE = route<{ id: string }>(async (_req, { params }) => {
  await requireAdmin();
  const { id } = await params;

  // Trashed jobs still reference the client until they are purged.
  const jobs = await prisma.job.count({ where: { clientId: id, deletedAt: undefined } });
  if (jobs > 0) throw conflict("This client still has jobs (including ones in the recycle bin)");

  await prisma.client.delete({ where: { id } });

  return NextResponse.json({ success: true }, { headers: { "Cache-Control": "private, no-store" } });
});
