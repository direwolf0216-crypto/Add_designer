import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { badRequest, notFound, parseJson, route } from "@/lib/api/http";
import { requireAdmin } from "@/lib/auth/session";
import { ROLES } from "@/lib/permissions";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .transform((v) => (v ? v : null));

const updateSchema = z
  .object({
    name: optionalText(120).optional(),
    phone: optionalText(32).optional(),
    role: z.enum(ROLES).optional(),
    status: z.enum(["ACTIVE", "PENDING", "INACTIVE"]).optional(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), { message: "No valid fields provided" });

export const PUT = route<{ id: string }>(async (req, { params }) => {
  const admin = await requireAdmin();
  const { id } = await params;
  const data = await parseJson(req, updateSchema);

  if (id === admin.id) {
    if (data.role && data.role !== "ADMIN") throw badRequest("You cannot change your own role");
    if (data.status && data.status !== "ACTIVE") throw badRequest("You cannot deactivate your own account");
  }

  const updated = await prisma.user.update({
    where: { id },
    data,
    select: { id: true, name: true, email: true, role: true, status: true },
  });

  return NextResponse.json(updated);
});

export const DELETE = route<{ id: string }>(async (_req, { params }) => {
  const admin = await requireAdmin();
  const { id } = await params;

  if (id === admin.id) throw badRequest("You cannot delete your own account");

  const user = await prisma.user.findUnique({ where: { id }, select: { email: true } });
  if (!user) throw notFound("User not found");

  // Accounts, sessions, notifications, push subscriptions, integrations and budgets cascade in the schema.
  await prisma.$transaction(async (tx) => {
    if (user.email) await tx.passwordResetToken.deleteMany({ where: { email: user.email } });
    await tx.user.delete({ where: { id } });
  });

  return NextResponse.json({ success: true });
});
