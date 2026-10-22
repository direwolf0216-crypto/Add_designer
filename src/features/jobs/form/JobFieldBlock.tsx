"use client";

import type { ReactNode } from "react";
import type { FormField } from "@/lib/forms/types";
import { useJobFormContext } from "./JobFormContext";

/** Label, control and validation message of a flat job field. The container id is the scroll target on errors. */
export default function JobFieldBlock({
  field,
  fieldName,
  className,
  children,
}: {
  field: FormField;
  /** Form key used for the container id and error lookup. */
  fieldName: string;
  /** Grid span classes appended to the container. */
  className: string;
  children: ReactNode;
}) {
  const { form, isVisible } = useJobFormContext();
  const isError = form.formState.errors[fieldName];
  const required = !!field.mandatory || (!!field.mandatoryRule && isVisible(field.mandatoryRule));

  return (
    <div id={`field-container-${fieldName}`} className={`flex flex-col gap-1.5 ${className}`}>
      <div className="flex justify-between items-center">
        <label className="text-[0.75rem] font-bold text-slate-600 uppercase tracking-[0.5px]">
          {field.name} {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      </div>
      {children}
      {isError && <span className="text-[0.7rem] font-semibold text-red-500 mt-1">{(isError.message as string) || `${field.name} is required`}</span>}
    </div>
  );
}
