import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { parseJson, route } from "@/lib/api/http";
import { requireUser } from "@/lib/auth/session";
import { forEachEntry, restoreItem } from "@/lib/services/recycleBin";

const idsSchema = z.object({ ids: z.array(z.string().min(1).max(50)).min(1).max(100) });

export const POST = route(async (req) => {
  const user = await requireUser();
  const { ids } = await parseJson(req, idsSchema);

  const entries = await prisma.recycleBin.findMany({ where: { id: { in: ids } } });
  const result = await forEachEntry(entries, (entry) => restoreItem(entry, user));

  if (result.failed.length > 0) {
    return NextResponse.json(
      { error: "Some items could not be restored", details: { restored: result.done.length, failed: result.failed } },
      { status: 409 }
    );
  }
  return NextResponse.json({ success: true, restored: result.done.length });
});
