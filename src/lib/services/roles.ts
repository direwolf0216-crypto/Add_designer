import "server-only";
import prisma from "@/lib/prisma";
import { badRequest, conflict, notFound } from "@/lib/api/http";
import { PERMISSIONS, ROLE_LABEL, SYSTEM_ROLES, isPermission, roleKey, staffPermissions, type Permission, type SystemRole } from "@/lib/permissions";

export type RoleSummary = {
  /** "OWNER" | "ADMIN" | "STAFF" | "custom:<id>" */
  key: string;
  kind: "system" | "custom";
  id: string;
  name: string;
  description: string | null;
  permissions: Permission[];
  /** Owner and Admin always hold everything; their permissions can't be edited. */
  locked: boolean;
  userCount: number;
};

const SYSTEM_DESCRIPTION: Record<SystemRole, string> = {
  OWNER: "Runs the press. Full access, and the only one who can manage admins.",
  ADMIN: "Full access to jobs, money, reports and the team.",
  STAFF: "Day-to-day work on the jobs assigned to them.",
};

const cleanPermissions = (list: readonly string[]) => PERMISSIONS.filter((p) => list.includes(p));

export async function listRoles(): Promise<RoleSummary[]> {
  const [custom, counts, staffOverrides] = await Promise.all([
    prisma.customRole.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { users: true } } } }),
    prisma.user.groupBy({ by: ["role"], _count: { _all: true } }),
    prisma.rolePermission.findMany({ where: { role: "STAFF" }, select: { role: true, permission: true, enabled: true } }),
  ]);
  const countOf = (role: string) => counts.find((c) => c.role === role)?._count._all ?? 0;

  const system: RoleSummary[] = SYSTEM_ROLES.map((role) => ({
    key: role,
    kind: "system",
    id: role,
    name: ROLE_LABEL[role],
    description: SYSTEM_DESCRIPTION[role],
    permissions: role === "STAFF" ? staffPermissions(staffOverrides) : [...PERMISSIONS],
    locked: role !== "STAFF",
    userCount: countOf(role),
  }));
  return [
    ...system,
    ...custom.map((r) => ({
      key: roleKey("CUSTOM", r.id),
      kind: "custom" as const,
      id: r.id,
      name: r.name,
      description: r.description,
      permissions: cleanPermissions(r.permissions),
      locked: false,
      userCount: r._count.users,
    })),
  ];
}

/** Trimmed, unique (case-insensitive, including the built-in names) role name. */
async function checkName(name: string, exceptId?: string) {
  const trimmed = name.trim().replace(/\s+/g, " ");
  if (!trimmed) throw badRequest("Give the role a name");
  if (Object.values(ROLE_LABEL).some((n) => n.toLowerCase() === trimmed.toLowerCase())) throw conflict(`"${trimmed}" is a built-in role`);
  const clash = await prisma.customRole.findFirst({ where: { name: { equals: trimmed, mode: "insensitive" }, ...(exceptId ? { NOT: { id: exceptId } } : {}) }, select: { id: true } });
  if (clash) throw conflict(`A role named "${trimmed}" already exists`);
  return trimmed;
}

export async function createRole(actorId: string, input: { name: string; description?: string | null; permissions: string[] }) {
  const name = await checkName(input.name);
  const role = await prisma.customRole.create({
    data: { name, description: input.description?.trim() || null, permissions: cleanPermissions(input.permissions.filter(isPermission)) },
  });
  await prisma.systemLog.create({ data: { userId: actorId, action: "ROLE_CREATED", details: `Created role ${name}` } });
  return role;
}

/** Edit a custom role, or the Staff role's permissions. Owner and Admin can't be edited. */
export async function updateRole(actorId: string, id: string, input: { name?: string; description?: string | null; permissions?: string[] }) {
  if (id === "OWNER" || id === "ADMIN") throw badRequest("Owner and Admin always have full access");

  if (id === "STAFF") {
    if (input.permissions === undefined) return;
    const on = new Set(input.permissions);
    await prisma.$transaction([
      ...PERMISSIONS.map((permission) =>
        prisma.rolePermission.upsert({
          where: { role_permission: { role: "STAFF", permission } },
          update: { enabled: on.has(permission) },
          create: { role: "STAFF", permission, enabled: on.has(permission) },
        })
      ),
      prisma.systemLog.create({ data: { userId: actorId, action: "ROLE_UPDATED", details: "Updated Staff permissions" } }),
    ]);
    return;
  }

  const existing = await prisma.customRole.findUnique({ where: { id }, select: { id: true, name: true } });
  if (!existing) throw notFound("Role not found");
  const name = input.name === undefined ? undefined : await checkName(input.name, id);
  await prisma.$transaction([
    prisma.customRole.update({
      where: { id },
      data: {
        name,
        description: input.description === undefined ? undefined : input.description?.trim() || null,
        permissions: input.permissions === undefined ? undefined : cleanPermissions(input.permissions),
      },
    }),
    prisma.systemLog.create({ data: { userId: actorId, action: "ROLE_UPDATED", details: `Updated role ${name ?? existing.name}` } }),
  ]);
}

/**
 * Delete a custom role. People who still have it move to `reassignTo` ("STAFF" or another custom
 * role) in the same transaction; a role in use can't be deleted without one.
 */
export async function deleteRole(actorId: string, id: string, reassignTo?: string | null) {
  const role = await prisma.customRole.findUnique({ where: { id }, include: { _count: { select: { users: true } } } });
  if (!role) throw notFound("Role not found");

  let target: { role: "STAFF" | "CUSTOM"; customRoleId: string | null } | null = null;
  if (role._count.users > 0) {
    if (reassignTo === "STAFF") target = { role: "STAFF", customRoleId: null };
    else if (reassignTo?.startsWith("custom:") && reassignTo.slice(7) !== id) {
      const other = await prisma.customRole.findUnique({ where: { id: reassignTo.slice(7) }, select: { id: true } });
      if (!other) throw badRequest("The role to move people to no longer exists");
      target = { role: "CUSTOM", customRoleId: other.id };
    } else {
      throw badRequest(`${role._count.users} ${role._count.users === 1 ? "person has" : "people have"} this role. Choose a role to move them to.`);
    }
  }

  await prisma.$transaction(async (tx) => {
    if (target) await tx.user.updateMany({ where: { customRoleId: id }, data: target });
    await tx.customRole.delete({ where: { id } });
    await tx.systemLog.create({ data: { userId: actorId, action: "ROLE_DELETED", details: `Deleted role ${role.name}` } });
  });
}
