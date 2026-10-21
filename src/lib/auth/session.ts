import "server-only";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { forbidden, unauthorized } from "@/lib/api/http";
import { isRole, PERMISSIONS, permissionsFromOverrides, resolvePermission, type AppRole, type Permission } from "@/lib/permissions";

export type SessionUser = {
  id: string;
  role: AppRole;
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
  return { id: user.id, role: user.role, name: user.name, email: user.email, permissions: user.permissions };
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

/** Every permission a role currently holds, in one query (used to fill the session token). */
export async function resolveRolePermissions(role: AppRole): Promise<Permission[]> {
  if (role === "ADMIN") return [...PERMISSIONS];
  return permissionsFromOverrides(role, await prisma.rolePermission.findMany({ where: { role } }));
}

/**
 * Whether a user holds a permission. Uses the permissions carried in the session (no DB round trip);
 * falls back to a lookup when they are missing (e.g. tokens issued before this field existed).
 */
export async function userCan(user: Pick<SessionUser, "role" | "permissions">, permission: Permission): Promise<boolean> {
  if (user.role === "ADMIN") return true;
  if (user.permissions) return user.permissions.includes(permission);
  return roleHasPermission(user.role, permission);
}

/** Throws 401/403 unless the signed-in user holds `permission`. */
export async function requirePermission(permission: Permission): Promise<SessionUser> {
  const user = await requireUser();
  if (!(await userCan(user, permission))) {
    throw forbidden("You do not have permission to perform this action");
  }
  return user;
}

/** For server pages: the signed-in user, or a redirect to the login page (e.g. revoked sessions). */
export async function requirePageUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}
