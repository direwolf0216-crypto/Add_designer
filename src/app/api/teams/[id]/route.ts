import { NextResponse } from "next/server";
import { parseJson, route } from "@/lib/api/http";
import { requireAdmin } from "@/lib/auth/session";
import { deleteTeam, teamSchema, updateTeam } from "@/lib/services/teams";

export const PUT = route<{ id: string }>(async (req, { params }) => {
  await requireAdmin();
  const { id } = await params;
  await updateTeam(id, await parseJson(req, teamSchema));
  return NextResponse.json({ success: true });
});

/** Jobs stay where they are; they just stop belonging to a team's queue. */
export const DELETE = route<{ id: string }>(async (_req, { params }) => {
  await requireAdmin();
  const { id } = await params;
  await deleteTeam(id);
  return NextResponse.json({ success: true });
});
