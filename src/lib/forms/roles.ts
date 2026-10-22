// Field roles: what a field means to the rest of the app. Pricing, the board, exports and validation ask
// for a role; labels stay free text. Layouts saved before roles existed are read through the same
// heuristics that used to live in each consumer, so nothing changes until an admin assigns roles.
import type { FieldRole, FormField, FormLayout } from "./types";

export interface FieldRoleDef {
  key: FieldRole;
  label: string;
  hint: string;
  /** Field types the role makes sense for (any type when empty). */
  types: string[];
}

export const FIELD_ROLES: FieldRoleDef[] = [
  { key: "customer", label: "Customer", hint: "Shown as the job's title on cards, lists and invoices.", types: ["SINGLE_LINE"] },
  { key: "phone", label: "Phone", hint: "Customer phone for the header, search and WhatsApp links.", types: ["PHONE", "SINGLE_LINE"] },
  { key: "email", label: "Email", hint: "Customer email for invoices.", types: ["EMAIL", "SINGLE_LINE"] },
  { key: "orderDate", label: "Order date", hint: "The record date: calendars, ledgers and availability.", types: ["DATE"] },
  { key: "dueDate", label: "Due date", hint: "Drives Due today / Overdue on the board and lists.", types: ["DATE"] },
  { key: "category", label: "Job category", hint: "Picks the pricing rule and groups reports.", types: ["PICK_LIST", "CATEGORY_PICKER"] },
  { key: "size", label: "Size", hint: "Read as dimensions + unit for per-sq-ft pricing.", types: ["SIZE", "SINGLE_LINE"] },
  { key: "quantity", label: "Quantity", hint: "Multiplies the rate on each line.", types: ["NUMBER", "DECIMAL", "SINGLE_LINE"] },
  { key: "status", label: "Status", hint: "The job's stage on the board.", types: ["STATUS_PICKER"] },
  { key: "total", label: "Total amount", hint: "The job's price (package).", types: ["CURRENCY", "NUMBER", "DECIMAL"] },
  { key: "advance", label: "Advance paid", hint: "Σ of the installments; the rest is due.", types: ["CURRENCY", "NUMBER", "DECIMAL"] },
  { key: "discount", label: "Discount", hint: "Taken off the line total.", types: ["CURRENCY", "NUMBER", "DECIMAL", "PERCENTAGE"] },
];

export const roleDef = (role: FieldRole): FieldRoleDef => FIELD_ROLES.find((r) => r.key === role)!;

/** Roles a field of this type may take. */
export const rolesForType = (type: string | undefined): FieldRoleDef[] =>
  FIELD_ROLES.filter((r) => r.types.length === 0 || r.types.includes(type ?? ""));

type AnyField = { id: string; name?: string; label?: string; type?: string; role?: FieldRole | string; isRecordDate?: boolean };

const nameOf = (f: AnyField) => (f.name ?? f.label ?? "").toLowerCase();

/** Built-in field ids that have always had a fixed meaning. */
const ROLE_BY_ID: Record<string, FieldRole> = {
  fld_b_client: "customer",
  fld_b_phone: "phone",
  fld_b_email: "email",
  fld_b_date: "orderDate",
  fld_b_job_category: "category",
  fld_b_category: "category",
  fld_b_status: "status",
  fld_b_package: "total",
  fld_b_advance: "advance",
  fld_print_size: "size",
  fld_print_dimensions: "size",
  fld_print_quantity: "quantity",
};

/** The role a field would have been given by the old label heuristics; undefined when none applies. */
export function inferRole(field: AnyField): FieldRole | undefined {
  const byId = ROLE_BY_ID[field.id];
  if (byId) return byId;
  const n = nameOf(field);
  const t = field.type;
  if (t === "STATUS_PICKER") return "status";
  if (t === "SIZE" || n.includes("size")) return "size";
  if (t === "DATE") {
    if (/due|deliver/.test(n)) return "dueDate";
    if (field.isRecordDate || /order|booking|record/.test(n)) return "orderDate";
    return undefined;
  }
  if (n.includes("discount")) return "discount";
  if (n.includes("advance")) return "advance";
  if (n.includes("package") || n.includes("total")) return "total";
  if (/\bqty\b|quantity/.test(n)) return "quantity";
  if (n.includes("category")) return "category";
  if (t === "PHONE" || /phone|mobile/.test(n)) return "phone";
  if (t === "EMAIL" || n.includes("email")) return "email";
  if (/client|customer/.test(n)) return "customer";
  return undefined;
}

type AnyLayout = { sections?: { fields?: AnyField[] }[] } | null | undefined;

const fieldsOf = (layout: AnyLayout): AnyField[] => layout?.sections?.flatMap((s) => s.fields ?? []) ?? [];

/**
 * The field holding `role`: an explicit assignment wins; otherwise the first field the heuristics match.
 * Explicit assignments elsewhere take the role away from heuristic matches.
 */
export function findRoleField<F extends AnyField>(layout: { sections?: { fields?: F[] }[] } | null | undefined, role: FieldRole): F | undefined {
  const fields = (layout?.sections?.flatMap((s) => s.fields ?? []) ?? []) as F[];
  const explicit = fields.find((f) => f.role === role);
  if (explicit) return explicit;
  const taken = new Set(fields.map((f) => f.role).filter(Boolean));
  if (taken.has(role)) return undefined;
  return fields.find((f) => !f.role && inferRole(f) === role);
}

/** The field's effective role: explicit, else inferred when no other field claims that role explicitly. */
export function effectiveRole(layout: AnyLayout, field: AnyField): FieldRole | undefined {
  if (field.role) return field.role as FieldRole;
  const guess = inferRole(field);
  if (!guess) return undefined;
  return findRoleField(layout, guess)?.id === field.id ? guess : undefined;
}

/** Every role with the field that holds it (or null), for the builder's checklist. */
export function roleAssignments(layout: AnyLayout): { role: FieldRoleDef; field: AnyField | null; inferred: boolean }[] {
  return FIELD_ROLES.map((role) => {
    const field = findRoleField(layout, role.key) ?? null;
    return { role, field, inferred: !!field && field.role !== role.key };
  });
}

/**
 * One-time migration for the builder: fills in `role` on every field the heuristics identify, so the
 * admin sees and can correct the assignments. Each role is given to at most one field.
 */
export function withInferredRoles<L extends FormLayout | { schema: FormLayout }>(layout: L): L {
  const schema: FormLayout = "schema" in layout ? (layout as { schema: FormLayout }).schema : (layout as FormLayout);
  if (!schema?.sections) return layout;
  const taken = new Set<FieldRole>(schema.sections.flatMap((s) => s.fields ?? []).map((f) => f.role).filter((r): r is FieldRole => !!r));
  let changed = false;
  const sections = schema.sections.map((s) => ({
    ...s,
    fields: (s.fields ?? []).map((f: FormField) => {
      if (f.role || f.archived) return f;
      const guess = inferRole(f);
      if (!guess || taken.has(guess)) return f;
      taken.add(guess);
      changed = true;
      return { ...f, role: guess };
    }),
  }));
  if (!changed) return layout;
  const next = { ...schema, sections };
  return ("schema" in layout ? { ...layout, schema: next } : next) as L;
}

/** Convenience: the id of the role's field, or null. */
export const roleFieldId = (layout: AnyLayout, role: FieldRole): string | null => findRoleField(layout, role)?.id ?? null;

export { fieldsOf as allLayoutFields };
