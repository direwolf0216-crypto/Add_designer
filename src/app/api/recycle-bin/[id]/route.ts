import { NextResponse, after } from "next/server";
import prisma from "@/lib/prisma";
import { notFound, route } from "@/lib/api/http";
import { requireAdmin } from "@/lib/auth/session";
import { deleteDriveFiles, purgeItem } from "@/lib/services/recycleBin";

export const DELETE = route<{ id: string }>(async (_req, { params }) => {
  const admin = await requireAdmin();
  const { id } = await params;

  const entry = await prisma.recycleBin.findUnique({ where: { id } });
  if (!entry) throw notFound();

  const { driveFileIds } = await purgeItem(entry, admin);
  after(() => deleteDriveFiles(admin, driveFileIds));

  return NextResponse.json({ success: true });
});
