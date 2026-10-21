import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { badRequest, notFound, parseJson, route } from "@/lib/api/http";
import { requireAdmin } from "@/lib/auth/session";
import { assertCanManage, resolveAssignableRole } from "@/lib/services/userRoles";

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
    /** "ADMIN" | "STAFF" | "custom:<id>" */
    role: z.string().min(1).max(80).optional(),
    status: z.enum(["ACTIVE", "PENDING", "INACTIVE"]).optional(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), { message: "No valid fields provided" });

export const PUT = route<{ id: string }>(async (req, { params }) => {
  const admin = await requireAdmin();
  const { id } = await params;
  const { role: key, ...data } = await parseJson(req, updateSchema);

  const target = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true, customRoleId: true } });
  if (!target) throw notFound("User not found");
  assertCanManage(admin, target);

  const role = key === undefined ? undefined : await resolveAssignableRole(admin, key);
  const roleChanged = role && (role.role !== target.role || role.customRoleId !== target.customRoleId);
  if (id === admin.id) {
    if (roleChanged) throw badRequest("You cannot change your own role");
    if (data.status && data.status !== "ACTIVE") throw badRequest("You cannot deactivate your own account");
  }
  if (target.role === "OWNER") {
    if (roleChanged) throw badRequest("Transfer ownership to someone else first");
    if (data.status && data.status !== "ACTIVE") throw badRequest("The owner's account can't be deactivated");
  }

  const updated = await prisma.user.update({
    where: { id },
    data: { ...data, ...(roleChanged ? role : {}) },
    select: { id: true, name: true, email: true, role: true, customRoleId: true, status: true },
  });

  return NextResponse.json(updated);
});

export const DELETE = route<{ id: string }>(async (_req, { params }) => {
  const admin = await requireAdmin();
  const { id } = await params;

  if (id === admin.id) throw badRequest("You cannot delete your own account");

  const user = await prisma.user.findUnique({ where: { id }, select: { id: true, email: true, role: true } });
  if (!user) throw notFound("User not found");
  assertCanManage(admin, user);
  if (user.role === "OWNER") throw badRequest("The owner's account can't be deleted");

  // Accounts, sessions, notifications, push subscriptions, integrations and budgets cascade in the schema.
  await prisma.$transaction(async (tx) => {
    if (user.email) await tx.passwordResetToken.deleteMany({ where: { email: user.email } });
    await tx.user.delete({ where: { id } });
  });

  return NextResponse.json({ success: true });
});
