// Shared by the client (UI gating) and the server (enforcement). Keep free of server-only imports.

/** Base role kinds stored on the user. CUSTOM users take their permissions from their custom role. */
export const ROLES = ["ADMIN", "MANAGER", "STAFF", "CUSTOM"] as const;
export type AppRole = (typeof ROLES)[number];

/** Roles that exist out of the box. Admin always holds every permission; Manager and Staff are editable. */
export const SYSTEM_ROLES = ["ADMIN", "MANAGER", "STAFF"] as const;
export type SystemRole = (typeof SYSTEM_ROLES)[number];

/** Built-in roles an admin can give someone. */
export const ASSIGNABLE_SYSTEM_ROLES = ["ADMIN", "MANAGER", "STAFF"] as const;

/** Built-in roles whose permissions an admin can switch on and off (stored as RolePermission rows). */
export const EDITABLE_SYSTEM_ROLES = ["MANAGER", "STAFF"] as const;
export type EditableSystemRole = (typeof EDITABLE_SYSTEM_ROLES)[number];

export const PERMISSIONS = [
  "view_jobs",
  "create_jobs",
  "edit_jobs",
  "delete_jobs",
  "view_all_jobs",
  "view_amounts",
  "view_transactions",
  "create_transactions",
  "edit_transactions",
  "delete_transactions",
  "view_analytics",
  "view_export_analytics",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const PERMISSION_INFO: Record<Permission, { label: string; description: string; icon: string }> = {
  view_jobs: { label: "View jobs", description: "Open the Jobs board, list, schedule and queue", icon: "ph-eye" },
  create_jobs: { label: "Create jobs", description: "Add new jobs and clients", icon: "ph-plus-circle" },
  edit_jobs: { label: "Edit jobs", description: "Edit details, move stages, set priority and assign people", icon: "ph-briefcase" },
  delete_jobs: { label: "Delete jobs", description: "Delete jobs and restore them from the recycle bin", icon: "ph-trash" },
  view_all_jobs: { label: "See every job", description: "Without this, people only see jobs assigned to them", icon: "ph-eye" },
  view_amounts: { label: "See amounts", description: "Job prices, payments and balances. Off hides every rupee figure on jobs", icon: "ph-currency-inr" },
  view_transactions: { label: "View ledger", description: "Open the daily ledger and payment history", icon: "ph-receipt" },
  create_transactions: { label: "Create entries", description: "Record income and expenses, and generate invoices", icon: "ph-plus-circle" },
  edit_transactions: { label: "Edit entries", description: "Change any income or expense entry", icon: "ph-pencil-simple-line" },
  delete_transactions: { label: "Delete entries", description: "Delete entries and restore them from the recycle bin", icon: "ph-trash" },
  view_analytics: { label: "View dashboard", description: "Business overview, charts and reports", icon: "ph-chart-line-up" },
  view_export_analytics: { label: "Export reports", description: "Download dashboard and ledger reports", icon: "ph-download-simple" },
};

export const PERMISSION_GROUPS: { title: string; permissions: Permission[] }[] = [
  { title: "Jobs", permissions: ["view_jobs", "create_jobs", "edit_jobs", "delete_jobs", "view_all_jobs", "view_amounts"] },
  { title: "Money", permissions: ["view_transactions", "create_transactions", "edit_transactions", "delete_transactions"] },
  { title: "Insights", permissions: ["view_analytics", "view_export_analytics"] },
];

export const ROLE_LABEL: Record<SystemRole, string> = { ADMIN: "Admin", MANAGER: "Manager", STAFF: "Staff" };

/** Staff defaults, used until an admin changes a Staff permission. */
export const STAFF_DEFAULTS: Record<Permission, boolean> = {
  view_jobs: true,
  create_jobs: true,
  edit_jobs: true,
  // Off: deleting is for managers and admins unless granted.
  delete_jobs: false,
  // Off: staff see the jobs assigned to them ("My jobs").
  view_all_jobs: false,
  // Off: staff work on jobs without seeing prices, payments or balances.
  view_amounts: false,
  view_transactions: true,
  create_transactions: true,
  edit_transactions: true,
  // Off: deleting ledger entries is for managers and admins unless granted.
  delete_transactions: false,
  view_analytics: true,
  view_export_analytics: false,
};

/** Manager defaults: every job, ledger, report and design permission (team and settings stay with admins). */
export const MANAGER_DEFAULTS: Record<Permission, boolean> = Object.fromEntries(PERMISSIONS.map((p) => [p, true])) as Record<Permission, boolean>;

const SYSTEM_DEFAULTS: Record<EditableSystemRole, Record<Permission, boolean>> = { MANAGER: MANAGER_DEFAULTS, STAFF: STAFF_DEFAULTS };

export function isEditableSystemRole(value: unknown): value is EditableSystemRole {
  return typeof value === "string" && (EDITABLE_SYSTEM_ROLES as readonly string[]).includes(value);
}

export function isPermission(value: string): value is Permission {
  return (PERMISSIONS as readonly string[]).includes(value);
}

export function isRole(value: unknown): value is AppRole {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

/**
 * Admins hold every permission, so nobody can lock the press out of its own settings.
 * Team and role management is theirs alone (a role that could edit roles could promote itself).
 */
export const hasFullAccess = (role: AppRole | string | null | undefined) => role === "ADMIN";

type Override = { role: string; permission: string; enabled: boolean };

/** Permissions that older data stored under one name; each expands to the new ones. */
export const LEGACY_PERMISSIONS: Record<string, Permission[]> = {
  manage_jobs: ["create_jobs", "edit_jobs", "delete_jobs"],
  manage_transactions: ["create_transactions", "edit_transactions", "delete_transactions"],
};

/** The section a person lands on: the first they may view, else the no-access page. */
export function homePathFor(role: string | null | undefined, permissions: readonly string[] | null | undefined): string {
  if (hasFullAccess(role)) return "/dashboard/overview";
  const has = (p: Permission) => permissions?.includes(p) ?? false;
  if (has("view_analytics")) return "/dashboard/overview";
  if (has("view_jobs")) return "/jobs";
  if (has("view_transactions")) return "/transactions/overview";
  return "/no-access";
}

/** Which permission a page needs ("admin" for settings), or null for pages everyone may open. */
export function permissionForPath(pathname: string): Permission | "admin" | null {
  if (pathname.startsWith("/dashboard")) return "view_analytics";
  if (pathname.startsWith("/jobs")) return "view_jobs";
  if (pathname.startsWith("/transactions")) return "view_transactions";
  if (pathname.startsWith("/settings")) return "admin";
  return null;
}

/** Current permission names from a stored list that may still hold legacy names. */
export function expandLegacyPermissions(list: readonly string[] | null | undefined): Permission[] {
  const out = new Set<Permission>();
  for (const p of list ?? []) {
    if (isPermission(p)) out.add(p);
    else for (const q of LEGACY_PERMISSIONS[p] ?? []) out.add(q);
  }
  return PERMISSIONS.filter((p) => out.has(p));
}

/** A Manager's or Staff member's permissions from the stored overrides, falling back to the role's defaults. */
export function systemRolePermissions(role: EditableSystemRole, overrides: Override[]): Permission[] {
  const find = (permission: string) => overrides.find((o) => o.role === role && o.permission === permission)?.enabled;
  return PERMISSIONS.filter((p) => {
    const legacy = Object.entries(LEGACY_PERMISSIONS).find(([, group]) => group.includes(p))?.[0];
    return find(p) ?? (legacy ? find(legacy) : undefined) ?? SYSTEM_DEFAULTS[role][p];
  });
}

/** Staff permissions from the stored overrides, falling back to the defaults. */
export function staffPermissions(overrides: Override[]): Permission[] {
  return systemRolePermissions("STAFF", overrides);
}

/** Every permission a user holds, given their role, their custom role's list and the Manager/Staff overrides. */
export function resolvePermissions(role: AppRole, customPermissions: readonly string[] | null | undefined, systemOverrides: Override[]): Permission[] {
  if (hasFullAccess(role)) return [...PERMISSIONS];
  if (isEditableSystemRole(role)) return systemRolePermissions(role, systemOverrides);
  return expandLegacyPermissions(customPermissions);
}

/** Role display name: the custom role's name, else the built-in label. */
export function roleLabel(role: string, customRoleName?: string | null): string {
  if (role === "CUSTOM") return customRoleName || "Custom";
  return ROLE_LABEL[role as SystemRole] ?? role;
}

/**
 * A single string for a role, used by pickers and the roles API: "ADMIN" | "MANAGER" | "STAFF" for
 * built-in roles, "custom:<id>" for a custom role.
 */
export function roleKey(role: string, customRoleId?: string | null): string {
  return role === "CUSTOM" && customRoleId ? `custom:${customRoleId}` : role;
}

export function parseRoleKey(key: string): { role: SystemRole; customRoleId: null } | { role: "CUSTOM"; customRoleId: string } | null {
  if (key.startsWith("custom:") && key.length > 7) return { role: "CUSTOM", customRoleId: key.slice(7) };
  // Saved before the Owner role was folded into Admin.
  if (key === "OWNER") return { role: "ADMIN", customRoleId: null };
  if ((SYSTEM_ROLES as readonly string[]).includes(key)) return { role: key as SystemRole, customRoleId: null };
  return null;
}
