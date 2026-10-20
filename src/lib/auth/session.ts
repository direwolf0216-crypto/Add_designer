import "server-only";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { forbidden, unauthorized } from "@/lib/api/http";
import { isRole, resolvePermission, type AppRole, type Permission } from "@/lib/permissions";

export type SessionUser = { id: string; role: AppRole; name?: string | null; email?: string | null };

/** The signed-in user, or null. Revocation (deactivated/deleted users) is applied in the jwt callback. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  const user = session?.user;
  if (!user?.id || !isRole(user.role)) return null;
  return { id: user.id, role: user.role, name: user.name, email: user.email };
}

/** Throws 401 unless signed in. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw unauthorized();
  return user;
}

/** Throws 403 unless the signed-in user is an ADMIN. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw forbidden();
  return user;
}

/** Whether a role currently holds a permission (DB override, else default matrix). Not cached: tiny table. */
export async function roleHasPermission(role: AppRole, permission: Permission): Promise<boolean> {
  if (role === "ADMIN") return true;
  const override = await prisma.rolePermission.findUnique({
    where: { role_permission: { role, permission } },
  });
  return resolvePermission(role, permission, override ? [override] : null);
}

/** Throws 401/403 unless the signed-in user holds `permission`. */
export async function requirePermission(permission: Permission): Promise<SessionUser> {
  const user = await requireUser();
  if (!(await roleHasPermission(user.role, permission))) {
    throw forbidden("You do not have permission to perform this action");
  }
  return user;
}
