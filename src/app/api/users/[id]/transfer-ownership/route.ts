import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { badRequest, notFound, route } from "@/lib/api/http";
import { requireOwner } from "@/lib/auth/session";

/** The owner hands ownership to another active member and becomes an admin, in one transaction. */
export const POST = route<{ id: string }>(async (_req, { params }) => {
  const owner = await requireOwner();
  const { id } = await params;
  if (id === owner.id) throw badRequest("You already own this account");

  const target = await prisma.user.findUnique({ where: { id }, select: { id: true, name: true, status: true } });
  if (!target) throw notFound("User not found");
  if (target.status !== "ACTIVE") throw badRequest("Ownership can only go to an active member");

  // Demote first: a unique index allows only one owner at a time.
  await prisma.$transaction([
    prisma.user.update({ where: { id: owner.id }, data: { role: "ADMIN", customRoleId: null } }),
    prisma.user.update({ where: { id }, data: { role: "OWNER", customRoleId: null } }),
    prisma.systemLog.create({ data: { userId: owner.id, action: "OWNERSHIP_TRANSFERRED", details: `Transferred ownership to ${target.name ?? id}` } }),
  ]);
  return NextResponse.json({ success: true });
});
