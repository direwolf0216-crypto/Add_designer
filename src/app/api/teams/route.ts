import { NextResponse } from "next/server";
import { parseJson, route } from "@/lib/api/http";
import { requireAdmin } from "@/lib/auth/session";
import prisma from "@/lib/prisma";
import { stageOptions } from "@/lib/jobs/tracking";
import { createTeam, listTeams, teamSchema } from "@/lib/services/teams";

/** Every team with its people and stages (Settings → Teams; the Jobs queue loads its own). */
export const GET = route(async () => {
  await requireAdmin();
  const [teams, layout] = await Promise.all([listTeams(), prisma.formLayout.findUnique({ where: { formKey: "JOB_FORM" }, select: { schema: true } })]);
  // The board stages a team can take over (closed ones are nobody's queue).
  const stages = stageOptions(layout?.schema as Parameters<typeof stageOptions>[0]).filter((s) => !/^delivered$|cancel/i.test(s.label));
  return NextResponse.json({ teams, stages }, { headers: { "Cache-Control": "private, no-store" } });
});

export const POST = route(async (req) => {
  await requireAdmin();
  const team = await createTeam(await parseJson(req, teamSchema));
  return NextResponse.json({ team }, { status: 201 });
});
