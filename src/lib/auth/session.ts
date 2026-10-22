import "server-only";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { forbidden, unauthorized } from "@/lib/api/http";
import { hasFullAccess, isRole, resolvePermissions, type AppRole, type Permission } from "@/lib/permissions";

export type SessionUser = {
  id: string;
  role: AppRole;
  customRoleId?: string | null;
  name?: string | null;
  email?: string | null;
  /** Permissions resolved into the session token (refreshed with role/status every minute). */
  permissions?: Permission[];
};

/** The signed-in user, or null. Revocation (deactivated/deleted users) is applied in the jwt callback. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  const user = session?.user;
  if (!user?.id || !isRole(user.role)) return null;
  return { id: user.id, role: user.role, customRoleId: user.customRoleId ?? null, name: user.name, email: user.email, permissions: user.permissions };
}

/** Throws 401 unless signed in. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw unauthorized();
  return user;
}

/** Throws 403 unless the signed-in user is an Admin. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (!hasFullAccess(user.role)) throw forbidden();
  return user;
}

/** Every permission a user currently holds, read fresh from the database (one round trip). */
export async function loadUserPermissions(userId: string) {
  const [user, systemOverrides] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { role: true, status: true, customRoleId: true, customRole: { select: { name: true, permissions: true } } } }),
    prisma.rolePermission.findMany({ where: { role: { in: ["MANAGER", "STAFF"] } }, select: { role: true, permission: true, enabled: true } }),
  ]);
  if (!user) return null;
  return {
    role: user.role as AppRole,
    status: user.status,
    customRoleId: user.customRoleId,
    roleName: user.customRole?.name ?? null,
    permissions: resolvePermissions(user.role as AppRole, user.customRole?.permissions, systemOverrides),
  };
}

/**
 * Whether a user holds a permission. Uses the permissions carried in the session (no DB round trip);
 * falls back to a lookup when they are missing (e.g. tokens issued before this field existed).
 */
export async function userCan(user: Pick<SessionUser, "id" | "role" | "permissions">, permission: Permission): Promise<boolean> {
  if (hasFullAccess(user.role)) return true;
  if (user.permissions) return user.permissions.includes(permission);
  return (await loadUserPermissions(user.id))?.permissions.includes(permission) ?? false;
}

/** Throws 401/403 unless the signed-in user holds `permission`. */
export async function requirePermission(permission: Permission): Promise<SessionUser> {
  const user = await requireUser();
  if (!(await userCan(user, permission))) {
    throw forbidden("You do not have permission to perform this action");
  }
  return user;
}

/** Throws 401/403 unless the signed-in user holds at least one of `permissions`. */
export async function requireAnyPermission(...permissions: Permission[]): Promise<SessionUser> {
  const user = await requireUser();
  for (const p of permissions) if (await userCan(user, p)) return user;
  throw forbidden("You do not have permission to perform this action");
}

/** For server pages: the signed-in user, or a redirect to the login page (e.g. revoked sessions). */
export async function requirePageUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}
