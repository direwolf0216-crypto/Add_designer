import "server-only";
import prisma from "@/lib/prisma";
import { badRequest, forbidden } from "@/lib/api/http";
import type { SessionUser } from "@/lib/auth/session";
import { parseRoleKey } from "@/lib/permissions";

/**
 * Turn a role picker value into the user columns, checking the actor may grant it:
 * ownership is never assigned (it is transferred) and only the owner can make someone an admin.
 */
export async function resolveAssignableRole(actor: Pick<SessionUser, "role">, key: string): Promise<{ role: "ADMIN" | "STAFF" | "CUSTOM"; customRoleId: string | null }> {
  const parsed = parseRoleKey(key);
  if (!parsed) throw badRequest("Unknown role");
  if (parsed.role === "OWNER") throw badRequest("Ownership is transferred from the owner's account, not assigned");
  if (parsed.role === "ADMIN" && actor.role !== "OWNER") throw forbidden("Only the owner can make someone an admin");
  if (parsed.role === "CUSTOM") {
    const exists = await prisma.customRole.findUnique({ where: { id: parsed.customRoleId }, select: { id: true } });
    if (!exists) throw badRequest("That role no longer exists");
  }
  return { role: parsed.role, customRoleId: parsed.customRoleId };
}

/** Admins manage staff and custom-role users; only the owner manages admins; nobody else touches the owner. */
export function assertCanManage(actor: Pick<SessionUser, "id" | "role">, target: { id: string; role: string }) {
  if (target.role === "OWNER" && actor.id !== target.id) throw forbidden("Only the owner can change the owner's account");
  if (target.role === "ADMIN" && actor.role !== "OWNER" && actor.id !== target.id) throw forbidden("Only the owner can change an admin");
}
