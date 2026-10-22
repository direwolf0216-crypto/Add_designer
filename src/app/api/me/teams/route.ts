import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { route } from "@/lib/api/http";
import { requireUser } from "@/lib/auth/session";

/** The teams the signed-in user belongs to (for per-team field visibility in the forms). */
export const GET = route(async () => {
  const user = await requireUser();
  const rows = await prisma.teamMember.findMany({ where: { userId: user.id }, select: { team: { select: { id: true, name: true, color: true } } } });
  return NextResponse.json({ teams: rows.map((r) => r.team) }, { headers: { "Cache-Control": "private, no-store" } });
});
