import "server-only";
import prisma from "@/lib/prisma";
import { badRequest } from "@/lib/api/http";
import type { SessionUser } from "@/lib/auth/session";
import { parseRoleKey } from "@/lib/permissions";

/** Turn a role picker value into the user columns. Only admins reach this (user management is theirs). */
export async function resolveAssignableRole(_actor: Pick<SessionUser, "role">, key: string): Promise<{ role: "ADMIN" | "MANAGER" | "STAFF" | "CUSTOM"; customRoleId: string | null }> {
  const parsed = parseRoleKey(key);
  if (!parsed) throw badRequest("Unknown role");
  if (parsed.role === "CUSTOM") {
    const exists = await prisma.customRole.findUnique({ where: { id: parsed.customRoleId }, select: { id: true } });
    if (!exists) throw badRequest("That role no longer exists");
  }
  return { role: parsed.role, customRoleId: parsed.customRoleId };
}

/** Admins manage everyone, so the press always keeps at least one active admin. */
export async function assertKeepsAnAdmin(target: { id: string; role: string; status?: string }, next: { role?: string; status?: string; deleted?: boolean }) {
  if (target.role !== "ADMIN") return;
  const losesAdmin = next.deleted || (next.role !== undefined && next.role !== "ADMIN") || (next.status !== undefined && next.status !== "ACTIVE");
  if (!losesAdmin) return;
  const others = await prisma.user.count({ where: { role: "ADMIN", status: "ACTIVE", NOT: { id: target.id } } });
  if (others === 0) throw badRequest("Keep at least one active admin: make someone else an admin first");
}
