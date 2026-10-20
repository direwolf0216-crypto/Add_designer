import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { notFound, route } from "@/lib/api/http";
import { requireUser } from "@/lib/auth/session";

export const GET = route(async () => {
  const { id } = await requireUser();

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, role: true, status: true },
  });
  if (!user) throw notFound("User not found");

  return NextResponse.json(user);
});
