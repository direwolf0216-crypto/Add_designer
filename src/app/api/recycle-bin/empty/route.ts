import { NextResponse, after } from "next/server";
import prisma from "@/lib/prisma";
import { route } from "@/lib/api/http";
import { requireAdmin } from "@/lib/auth/session";
import { deleteDriveFiles, forEachEntry, purgeItem } from "@/lib/services/recycleBin";

export const POST = route(async () => {
  const admin = await requireAdmin();

  const entries = await prisma.recycleBin.findMany({ orderBy: { trashedAt: "asc" } });
  const files: string[] = [];
  const result = await forEachEntry(entries, async (entry) => {
    const { driveFileIds } = await purgeItem(entry, admin);
    files.push(...driveFileIds);
  });
  after(() => deleteDriveFiles(admin, files));

  await prisma.systemLog.create({
    data: {
      action: "RECYCLE_BIN_EMPTY",
      details: `Emptied recycle bin: ${result.done.length} deleted, ${result.failed.length} failed`,
      userId: admin.id,
    },
  });

  if (result.failed.length > 0) {
    return NextResponse.json(
      { error: "Some items could not be deleted", details: { deleted: result.done.length, failed: result.failed } },
      { status: 409 }
    );
  }
  return NextResponse.json({ success: true, deleted: result.done.length });
});
