import type { FieldOption, FormField, StatusOption, UserPicklistConfig } from "./types";

/** Multi-select values are stored as "a, b, c"; older records may hold an array. */
export function splitMultiValue(value: unknown): string[] {
  if (typeof value === "string" && value.trim()) return value.split(",").map((s) => s.trim());
  return Array.isArray(value) ? (value as string[]) : [];
}

/** Display labels for pick-list options in either format. */
export function optionLabels(options: FieldOption[]): string[] {
  return options.map((opt) => {
    const o = opt as { label?: string; value?: string };
    return (o.label || o.value || opt) as string;
  });
}

/**
 * Options plus any selected values that are no longer in the layout (renamed/removed options),
 * so editing an old record still shows what it holds.
 */
export function withLegacyOptions(options: FieldOption[], selected: string[]): FieldOption[] {
  const legacy = selected.filter(
    (s) =>
      !options.some((opt) => {
        const o = opt as { label?: string; value?: string };
        return (o.value || o.label || opt) === s;
      })
  );
  return [...options, ...legacy];
}

/** Default value for a pick-list: its first option's label (or the option itself when a string). */
export function firstOptionDefault(field: FormField): unknown {
  const first = field.options![0] as { label?: string };
  return first.label || first || "";
}

/** True when a pick-list style field has options and should default to the first one. */
export function defaultsToFirstOption(field: FormField): boolean {
  return (
    (field.type === "PICK_LIST" || field.type === "CATEGORY_PICKER" || field.id === "fld_b_job_category") &&
    !!field.options &&
    field.options.length > 0
  );
}

export interface PicklistUser {
  id: string;
  role: string;
}

/** Users a user-picklist field offers, honouring its role/user restriction. */
export function filterUsersForField<U extends PicklistUser>(users: U[], config?: UserPicklistConfig): U[] {
  if (!config) return users;
  if (config.mode === "ROLES" && config.roles && config.roles.length > 0) {
    return users.filter((u) => config.roles!.includes(u.role));
  }
  if (config.mode === "USERS" && config.userIds && config.userIds.length > 0) {
    return users.filter((u) => config.userIds!.includes(u.id));
  }
  return users;
}

/**
 * Status options a STATUS_PICKER offers. With a future-date restriction, the restricted statuses
 * are hidden while the dependent date (local calendar day) is after today.
 */
export function availableStatusOptions(
  field: FormField,
  dependentDateValue: unknown,
  now: Date = new Date()
): StatusOption[] {
  const opts = field.statusOptions || [];
  const restriction = field.futureDateRestriction;

  let isRestrictedDate = false;
  if (restriction?.enabled && restriction?.dateFieldId && dependentDateValue) {
    const dateObj = new Date(dependentDateValue as string);
    dateObj.setHours(0, 0, 0, 0);
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    if (dateObj > today) isRestrictedDate = true;
  }

  return opts.filter((opt) => !(isRestrictedDate && restriction?.restrictedStatuses?.includes(opt.label)));
}
