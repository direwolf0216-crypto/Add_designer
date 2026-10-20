import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { notFound, parseJson, route } from "@/lib/api/http";
import { requireUser } from "@/lib/auth/session";

const preferencesSchema = z.object({
  emailNotifications: z.boolean().optional(),
  pushNotifications: z.boolean().optional(),
});

export const GET = route(async () => {
  const { id } = await requireUser();

  const user = await prisma.user.findUnique({
    where: { id },
    select: { emailNotifications: true, pushNotifications: true },
  });
  if (!user) throw notFound("User not found");

  return NextResponse.json(user);
});

export const PATCH = route(async (req) => {
  const { id } = await requireUser();
  const data = await parseJson(req, preferencesSchema);

  await prisma.user.update({ where: { id }, data });

  return NextResponse.json({ success: true });
});
