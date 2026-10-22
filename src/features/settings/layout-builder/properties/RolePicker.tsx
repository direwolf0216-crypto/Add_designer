"use client";

import CustomDropdown from "@/components/ui/CustomDropdown";
import { FIELD_ROLES, findRoleField, roleDef, rolesForType } from "@/lib/forms/roles";
import type { FieldRole, FormField, FormLayout } from "@/lib/layout-builder/types";

interface RolePickerProps {
  field: FormField;
  layout: FormLayout;
  onChange: (role: FieldRole | null) => void;
}

/** What the field means to the app: pricing, the board and exports read roles instead of labels. */
export default function RolePicker({ field, layout, onChange }: RolePickerProps) {
  const compatible = rolesForType(field.type);
  const current = field.role ? roleDef(field.role) : null;
  const options = [
    { label: "No role (plain field)", value: "" },
    ...compatible.map((r) => ({ label: r.label, value: r.key })),
    // A role already on this field stays listed even if its type no longer fits.
    ...(current && !compatible.some((r) => r.key === current.key) ? [{ label: current.label, value: current.key }] : []),
  ];
  const heldBy = field.role ? null : null;
  const takenFrom = (role: FieldRole) => {
    const holder = findRoleField(layout.schema, role);
    return holder && holder.id !== field.id ? holder : null;
  };

  return (
    <div>
      <label className="text-[0.75rem] font-bold text-slate-600 mb-1.5 flex items-center gap-1.5">
        Role
        <span className="rounded-md bg-violet-50 border border-violet-200 px-1.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-wider text-violet-700">What it means</span>
      </label>
      <CustomDropdown
        options={options}
        value={field.role ?? ""}
        onChange={(v) => onChange((v || null) as FieldRole | null)}
        placeholder="No role"
        className="h-[40px] text-sm font-semibold"
      />
      <p className="mt-1.5 text-[0.7rem] text-slate-500 leading-snug">
        {current ? current.hint : "Pricing, the board, exports and invoices read fields by role, so you can label this field however you like."}
      </p>
      {field.role && (() => { const other = takenFrom(field.role); return other ? (
        <p className="mt-1 text-[0.7rem] text-amber-700 leading-snug">Moved here from “{other.name}”.</p>
      ) : null; })()}
      {heldBy}
      {!field.role && compatible.length > 0 && (() => {
        const free = compatible.filter((r) => !findRoleField(layout.schema, r.key));
        return free.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {free.slice(0, 4).map((r) => (
              <button key={r.key} type="button" onClick={() => onChange(r.key)} className="rounded-lg border border-dashed border-slate-300 px-2 py-1 text-[0.7rem] font-bold text-slate-600 hover:border-violet-300 hover:text-violet-700 hover:bg-violet-50 transition-colors">
                Use as {r.label}
              </button>
            ))}
          </div>
        ) : null;
      })()}
      {FIELD_ROLES.length === 0 && null}
    </div>
  );
}
