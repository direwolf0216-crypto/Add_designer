"use client";

import { useSession } from "next-auth/react";
import { hasFullAccess, isPermission } from "@/lib/permissions";

/**
 * UI gating from the permissions carried in the session (refreshed about once a minute).
 * Every action is enforced again on the server.
 */
export function usePermissions() {
  const { data: session, status } = useSession();
  const role = session?.user?.role;
  const granted = session?.user?.permissions;

  const checkPermission = (action: string): boolean => {
    if (status !== "authenticated") return false;
    if (hasFullAccess(role)) return true;
    return isPermission(action) && (granted?.includes(action) ?? false);
  };

  return { checkPermission, role, isAdmin: hasFullAccess(role) };
}
