import { NextResponse } from "next/server";
import { NotificationType } from "@prisma/client";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { badRequest, parseJson, route } from "@/lib/api/http";
import { requireAdmin, requireUser } from "@/lib/auth/session";
import { PERMISSIONS, ROLES, isPermission, resolvePermission } from "@/lib/permissions";

const NOTIFY_PREFIX = "notify_";

function isNotifyPermission(permission: string): boolean {
  if (!permission.startsWith(NOTIFY_PREFIX)) return false;
  return (Object.values(NotificationType) as string[]).includes(permission.slice(NOTIFY_PREFIX.length));
}

const updateSchema = z.object({
  role: z.enum(ROLES),
  permission: z
    .string()
    .refine((p) => isPermission(p) || isNotifyPermission(p), { message: "Invalid permission" }),
  enabled: z.boolean(),
});

/**
 * Returns the full effective matrix (DB override, else default) for every role and core permission,
 * plus any stored notify_* rows. Nothing is written on read.
 */
export const GET = route(async () => {
  await requireUser();

  const overrides = await prisma.rolePermission.findMany({
    select: { id: true, role: true, permission: true, enabled: true },
  });

  const rows: { id: string; role: string; permission: string; enabled: boolean }[] = [];
  for (const role of ROLES) {
    for (const permission of PERMISSIONS) {
      const stored = overrides.find((o) => o.role === role && o.permission === permission);
      rows.push({
        id: stored?.id ?? `default-${role}-${permission}`,
        role,
        permission,
        enabled: resolvePermission(role, permission, overrides),
      });
    }
  }
  for (const o of overrides) {
    if (!isPermission(o.permission)) rows.push(o);
  }

  rows.sort((a, b) => a.role.localeCompare(b.role) || a.permission.localeCompare(b.permission));
  return NextResponse.json(rows);
});

export const PUT = route(async (req) => {
  await requireAdmin();
  const { role, permission, enabled } = await parseJson(req, updateSchema);

  if (role === "ADMIN" && !permission.startsWith(NOTIFY_PREFIX)) {
    throw badRequest("Cannot modify core ADMIN permissions");
  }

  const updated = await prisma.rolePermission.upsert({
    where: { role_permission: { role, permission } },
    update: { enabled },
    create: { role, permission, enabled },
  });

  return NextResponse.json(updated);
});
