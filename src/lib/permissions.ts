// Shared by the client (UI gating) and the server (enforcement). Keep free of server-only imports.

export const ROLES = ["ADMIN", "STAFF", "PHOTOGRAPHER"] as const;
export type AppRole = (typeof ROLES)[number];

export const PERMISSIONS = [
  "manage_jobs",
  "view_transactions",
  "manage_transactions",
  "view_analytics",
  "manage_users",
  "view_galleries",
  "manage_galleries",
  "view_export_analytics",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

/** Defaults used until an admin overrides a cell in the Roles & Permissions matrix. */
export const DEFAULT_MATRIX: Record<AppRole, Record<Permission, boolean>> = {
  ADMIN: {
    manage_jobs: true,
    view_transactions: true,
    manage_transactions: true,
    view_analytics: true,
    manage_users: true,
    view_galleries: true,
    manage_galleries: true,
    view_export_analytics: true,
  },
  STAFF: {
    manage_jobs: true,
    view_transactions: true,
    manage_transactions: false,
    view_analytics: true,
    manage_users: false,
    view_galleries: true,
    manage_galleries: false,
    view_export_analytics: false,
  },
  PHOTOGRAPHER: {
    manage_jobs: false,
    view_transactions: false,
    manage_transactions: false,
    view_analytics: false,
    manage_users: false,
    view_galleries: true,
    manage_galleries: true,
    view_export_analytics: false,
  },
};

export function isPermission(value: string): value is Permission {
  return (PERMISSIONS as readonly string[]).includes(value);
}

export function isRole(value: unknown): value is AppRole {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

/**
 * Resolve a permission from DB overrides (if any) falling back to the default matrix.
 * ADMIN always holds every core permission so an admin can never lock themselves out.
 */
export function resolvePermission(
  role: AppRole,
  permission: Permission,
  overrides?: { role: string; permission: string; enabled: boolean }[] | null
): boolean {
  if (role === "ADMIN") return true;
  const override = overrides?.find((p) => p.role === role && p.permission === permission);
  if (override) return override.enabled;
  return DEFAULT_MATRIX[role]?.[permission] ?? false;
}
