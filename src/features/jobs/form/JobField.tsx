"use client";

import Autocomplete from "@/components/ui/Autocomplete";
import FieldRenderer from "@/components/forms/FieldRenderer";
import { IconWrap } from "@/components/forms/fields/FieldChrome";
import TextField from "@/components/forms/fields/TextField";
import { getFieldIcon } from "@/lib/forms/fieldIcon";
import LockedField from "@/components/forms/fields/LockedField";
import { resolveFieldKind } from "@/lib/forms/fieldKind";
import { JOB_FORM_FIELD_MAP, fieldNameFor } from "@/lib/forms/fieldMap";
import type { FormField } from "@/lib/forms/types";
import { useJobFormContext } from "./JobFormContext";

const LOCATION_SUGGESTIONS: string[] = [];
const toFieldName = (id: string) => fieldNameFor(JOB_FORM_FIELD_MAP, id);

/**
 * One flat (react-hook-form backed) job field. Client and location have bespoke inputs and the
 * package total is read-only (it is computed); everything else goes through FieldRenderer.
 */
export default function JobField({ field }: { field: FormField }) {
  const { form, usersWithAvailability, driveStatus } = useJobFormContext();
  const { register, watch, setValue, formState: { errors } } = form;
  // `any` casts: field names come from the user-defined layout, not from JobFormData.
  const fieldName = toFieldName(field.id) as any;
  const isError = !!errors[fieldName as string];
  const setValidated = (val: unknown) => setValue(fieldName, val as any, { shouldValidate: true });
  const icon = getFieldIcon(field.name, field.type, field.role);
  if (field.lockedForViewer) return <LockedField field={field} value={watch(fieldName)} variant="job" />;

  if (field.id === "fld_b_client") {
    return (
      <IconWrap icon={icon}>
        <TextField
          field={field}
          name={fieldName}
          value={undefined}
          onChange={setValidated}
          register={register(fieldName, { required: field.mandatory })}
          error={isError}
          variant="job"
          inputType="text"
          fallbackPlaceholder="e.g. Rahul Sharma"
        />
      </IconWrap>
    );
  }

  if (field.id === "fld_b_location") {
    return (
      <IconWrap icon={icon}>
        <Autocomplete
          suggestions={LOCATION_SUGGESTIONS}
          value={watch(fieldName) || ""}
          onChange={(val) => setValidated(val)}
          placeholder={field.placeholder || "e.g. Grand Hyatt, City"}
          error={isError}
          className="pl-10"
        />
      </IconWrap>
    );
  }

  const kind = resolveFieldKind(field, "job");

  if (fieldName === "package" && kind === "text") {
    return (
      <IconWrap icon={icon} hideIcon>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
            <span className="text-gray-500 font-bold text-[1rem]">₹</span>
          </div>
          <input type="text" readOnly className={`flex h-[45px] w-full rounded-xl border px-4 pl-8 py-2 text-[1rem] font-bold text-slate-600 bg-slate-50 border-slate-200 cursor-not-allowed`} {...register(fieldName)} />
        </div>
      </IconWrap>
    );
  }

  // Native inputs are registered (uncontrolled) so react-hook-form can focus them on errors.
  const isNative = kind === "text" || kind === "textarea" || kind === "checkbox";

  return (
    <FieldRenderer
      field={field}
      name={fieldName}
      value={watch(fieldName)}
      onChange={kind === "file" ? (vals) => setValue(fieldName, vals) : setValidated}
      register={isNative ? register(fieldName, { required: field.mandatory }) : undefined}
      error={isError}
      variant="job"
      context={{
        users: usersWithAvailability,
        driveStatus,
        moduleName: "Jobs",
        categoryName: watch("category") || "Uncategorized",
        getValue: (name) => watch(name as any),
        fieldNameFor: toFieldName,
      }}
    />
  );
}
