import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { route } from "@/lib/api/http";
import { requireAdmin } from "@/lib/auth/session";

/** Publish history of one layout, newest first (each entry carries its full schema for diffs and restore). */
export const GET = route<{ formKey: string }>(async (_req, { params }) => {
  await requireAdmin();
  const { formKey } = await params;
  const versions = await prisma.formLayoutVersion.findMany({
    where: { formKey },
    orderBy: { version: "desc" },
    take: 50,
    select: { id: true, version: true, name: true, note: true, authorName: true, createdAt: true, schema: true },
  });
  return NextResponse.json({ versions });
});
