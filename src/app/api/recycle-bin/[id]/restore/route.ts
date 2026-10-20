import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { notFound, route } from "@/lib/api/http";
import { requireUser } from "@/lib/auth/session";
import { restoreItem } from "@/lib/services/recycleBin";

export const POST = route<{ id: string }>(async (_req, { params }) => {
  const user = await requireUser();
  const { id } = await params;

  const entry = await prisma.recycleBin.findUnique({ where: { id } });
  if (!entry) throw notFound();

  await restoreItem(entry, user);
  return NextResponse.json({ success: true });
});
