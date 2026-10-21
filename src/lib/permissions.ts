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
  "manage_jobs",
  "view_all_jobs",
  "view_amounts",
  "view_transactions",
  "manage_transactions",
  "view_analytics",
  "view_export_analytics",
  "view_designs",
  "manage_designs",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const PERMISSION_INFO: Record<Permission, { label: string; description: string; icon: string }> = {
  manage_jobs: { label: "Create & edit jobs", description: "Add new jobs, edit details, move stages and assign people", icon: "ph-briefcase" },
  view_all_jobs: { label: "See every job", description: "Without this, people only see jobs assigned to them", icon: "ph-eye" },
  view_amounts: { label: "See amounts", description: "Job prices, payments and balances. Off hides every rupee figure on jobs", icon: "ph-currency-inr" },
  view_transactions: { label: "View ledger", description: "Open the daily ledger and payment history", icon: "ph-receipt" },
  manage_transactions: { label: "Manage ledger", description: "Add, edit and delete income and expenses", icon: "ph-pencil-simple-line" },
  view_analytics: { label: "View dashboard", description: "Business overview, charts and reports", icon: "ph-chart-line-up" },
  view_export_analytics: { label: "Export reports", description: "Download dashboard and ledger reports", icon: "ph-download-simple" },
  view_designs: { label: "View designs", description: "See proofs and artwork", icon: "ph-image" },
  manage_designs: { label: "Manage designs", description: "Upload and update proofs and artwork", icon: "ph-paint-brush" },
};

export const PERMISSION_GROUPS: { title: string; permissions: Permission[] }[] = [
  { title: "Jobs", permissions: ["manage_jobs", "view_all_jobs", "view_amounts"] },
  { title: "Money", permissions: ["view_transactions", "manage_transactions"] },
  { title: "Insights", permissions: ["view_analytics", "view_export_analytics"] },
  { title: "Designs", permissions: ["view_designs", "manage_designs"] },
];

export const ROLE_LABEL: Record<SystemRole, string> = { ADMIN: "Admin", MANAGER: "Manager", STAFF: "Staff" };

/** Staff defaults, used until an admin changes a Staff permission. */
export const STAFF_DEFAULTS: Record<Permission, boolean> = {
  manage_jobs: true,
  // Off: staff see the jobs assigned to them ("My jobs").
  view_all_jobs: false,
  // Off: staff work on jobs without seeing prices, payments or balances.
  view_amounts: false,
  view_transactions: true,
  manage_transactions: false,
  view_analytics: true,
  view_export_analytics: false,
  view_designs: true,
  manage_designs: false,
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

/** A Manager's or Staff member's permissions from the stored overrides, falling back to the role's defaults. */
export function systemRolePermissions(role: EditableSystemRole, overrides: Override[]): Permission[] {
  return PERMISSIONS.filter((p) => overrides.find((o) => o.role === role && o.permission === p)?.enabled ?? SYSTEM_DEFAULTS[role][p]);
}

/** Staff permissions from the stored overrides, falling back to the defaults. */
export function staffPermissions(overrides: Override[]): Permission[] {
  return systemRolePermissions("STAFF", overrides);
}

/** Every permission a user holds, given their role, their custom role's list and the Manager/Staff overrides. */
export function resolvePermissions(role: AppRole, customPermissions: readonly string[] | null | undefined, systemOverrides: Override[]): Permission[] {
  if (hasFullAccess(role)) return [...PERMISSIONS];
  if (isEditableSystemRole(role)) return systemRolePermissions(role, systemOverrides);
  return (customPermissions ?? []).filter(isPermission);
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
