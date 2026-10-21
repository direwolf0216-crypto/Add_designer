import { NextResponse } from "next/server";
import { NotificationType } from "@prisma/client";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { parseJson, route } from "@/lib/api/http";
import { requireAdmin } from "@/lib/auth/session";
import { SYSTEM_ROLES } from "@/lib/permissions";

/**
 * Per-role notification switches (`notify_<TYPE>`) for the built-in roles. Core permissions are
 * edited through /api/roles.
 */
const NOTIFY_PREFIX = "notify_";

const isNotifyPermission = (permission: string) =>
  permission.startsWith(NOTIFY_PREFIX) && (Object.values(NotificationType) as string[]).includes(permission.slice(NOTIFY_PREFIX.length));

const updateSchema = z.object({
  role: z.enum(SYSTEM_ROLES),
  permission: z.string().refine(isNotifyPermission, { message: "Invalid permission" }),
  enabled: z.boolean(),
});

export const GET = route(async () => {
  await requireAdmin();
  const rows = await prisma.rolePermission.findMany({
    where: { permission: { startsWith: NOTIFY_PREFIX } },
    select: { id: true, role: true, permission: true, enabled: true },
    orderBy: [{ role: "asc" }, { permission: "asc" }],
  });
  return NextResponse.json(rows);
});

export const PUT = route(async (req) => {
  await requireAdmin();
  const { role, permission, enabled } = await parseJson(req, updateSchema);
  const updated = await prisma.rolePermission.upsert({
    where: { role_permission: { role, permission } },
    update: { enabled },
    create: { role, permission, enabled },
  });
  return NextResponse.json(updated);
});
