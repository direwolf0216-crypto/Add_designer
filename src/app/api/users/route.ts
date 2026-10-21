import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { conflict, parseJson, route } from "@/lib/api/http";
import { requireAdmin, requireUser } from "@/lib/auth/session";
import { generateTempPassword } from "@/lib/auth/tempPassword";
import { hasFullAccess, roleKey, roleLabel } from "@/lib/permissions";
import { resolveAssignableRole } from "@/lib/services/userRoles";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const inviteSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  email: z.string().trim().toLowerCase().email().max(254),
  phone: z.string().trim().max(32).optional(),
  /** "ADMIN" | "STAFF" | "custom:<id>" */
  role: z.string().min(1).max(80),
});

/** Adds `roleKey` (picker value) and `roleName` (display name), dropping the nested relation. */
function withRoleInfo<T extends { role: string; customRoleId: string | null; customRole: { name: string } | null }>({ customRole, ...u }: T) {
  return { ...u, roleKey: roleKey(u.role, u.customRoleId), roleName: roleLabel(u.role, customRole?.name) };
}

export const GET = route(async () => {
  const user = await requireUser();

  if (!hasFullAccess(user.role)) {
    const users = await prisma.user.findMany({
      select: { id: true, idNumber: true, name: true, image: true, role: true, status: true, customRoleId: true, customRole: { select: { name: true } } },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(users.map(withRoleInfo));
  }

  const [users, activeTokens] = await Promise.all([
    prisma.user.findMany({
      select: {
        id: true,
        idNumber: true,
        name: true,
        image: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        invitedAt: true,
        customRoleId: true,
        customRole: { select: { name: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.passwordResetToken.findMany({
      where: { expires: { gt: new Date() } },
      select: { email: true, token: true, expires: true },
      orderBy: { expires: "desc" },
    }),
  ]);

  const tokenByEmail = new Map<string, string>();
  for (const t of activeTokens) {
    const key = t.email.toLowerCase();
    if (!tokenByEmail.has(key)) tokenByEmail.set(key, t.token);
  }

  const response = NextResponse.json(
    users.map(withRoleInfo).map((u) => {
      const tempPassword = u.email ? tokenByEmail.get(u.email.toLowerCase()) : undefined;
      return tempPassword ? { ...u, tempPassword } : u;
    })
  );
  response.headers.set("Cache-Control", "no-store");
  return response;
});

export const POST = route(async (req) => {
  const admin = await requireAdmin();
  const { name, email, phone, role: key } = await parseJson(req, inviteSchema);
  const role = await resolveAssignableRole(admin, key);

  const existingUser = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existingUser) throw conflict("A user with this email already exists");

  const tempPassword = generateTempPassword();
  // The account password is unguessable; the user signs in with the temp code and is forced to set a real one.
  const hashedPassword = await bcrypt.hash(randomBytes(32).toString("base64url"), 12);

  const newUser = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        name,
        email,
        phone: phone || null,
        password: hashedPassword,
        ...role,
        status: "ACTIVE",
        invitedAt: new Date(),
      },
      select: { id: true, name: true, email: true, role: true, status: true, invitedAt: true },
    });
    await tx.passwordResetToken.deleteMany({ where: { email } });
    await tx.passwordResetToken.create({
      data: { email, token: tempPassword, expires: new Date(Date.now() + INVITE_TTL_MS) },
    });
    return created;
  });

  const response = NextResponse.json({ user: newUser, tempPassword }, { status: 201 });
  response.headers.set("Cache-Control", "no-store");
  return response;
});
