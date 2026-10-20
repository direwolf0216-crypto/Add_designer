"use client";

import { useSession } from "next-auth/react";
import useSWR from "swr";
import { isPermission, isRole, resolvePermission } from "@/lib/permissions";

type PermissionRow = { role: string; permission: string; enabled: boolean };

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function usePermissions() {
  const { data: session, status } = useSession();

  const { data: dbPermissions } = useSWR<PermissionRow[]>(
    status === "authenticated" ? "/api/permissions" : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60000 }
  );

  // UI gating only; every action is enforced again on the server.
  const checkPermission = (action: string): boolean => {
    if (status !== "authenticated") return false;
    const role = session?.user?.role;
    if (!isRole(role)) return false;
    if (role === "ADMIN") return true;
    if (!isPermission(action)) return false;
    // Until the matrix loads, fall back to defaults so gated UI doesn't flicker.
    return resolvePermission(role, action, Array.isArray(dbPermissions) ? dbPermissions : null);
  };

  return { checkPermission };
}
