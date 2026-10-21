"use client";

import React from "react";
import { JOB_FORM_FIELD_MAP, allFields, fieldNameFor } from "@/lib/forms/fieldMap";
import type { FormSection } from "@/lib/forms/types";
import { sortFinancialFields } from "@/lib/jobs/formMapping";
import { GrandTotal, OutstandingBalance } from "./FinancialSummary";
import InstallmentsEditor from "./InstallmentsEditor";
import JobField from "./JobField";
import JobFieldBlock from "./JobFieldBlock";
import { useJobFormContext } from "./JobFormContext";
import LineItemRates from "./LineItemRates";

/**
 * A regular layout section. The financial section (`sec_job_financial`) is special: its advance
 * field becomes the installments editor, the package field is replaced by the line-item rates
 * (package itself stays registered but hidden), and grand total / outstanding balance are added.
 */
export default function FlatSection({ section }: { section: FormSection }) {
  const { job, layoutSchema, isVisible } = useJobFormContext();
  const isFinancial = section.id === "sec_job_financial";
  // The first STATUS_PICKER is the job's main status, stored as `status`.
  const statusF = allFields(layoutSchema).find((f) => f.type === "STATUS_PICKER");

  return (
    <div className={`grid gap-5 items-start ${isFinancial ? "grid-cols-1 md:grid-cols-12" : "grid-cols-1 md:grid-cols-2"}`}>
      {(isFinancial ? sortFinancialFields(section.fields, JOB_FORM_FIELD_MAP, false) : section.fields).map((field) => {
        let fieldName = fieldNameFor(JOB_FORM_FIELD_MAP, field.id);
        if (statusF && field.id === statusF.id) fieldName = "status";

        if (field.visibilityRule && !isVisible(field.visibilityRule)) return null;
        if (!job && field.type === "STATUS_PICKER") return null;
        if (fieldName === "advance") return <InstallmentsEditor key="installments-section" />;

        const isPackage = isFinancial && fieldName === "package";
        return (
          <React.Fragment key={field.id}>
            {isPackage && <LineItemRates />}

            {isPackage ? (
              <div className="hidden">
                <JobField field={field} />
              </div>
            ) : (
              <JobFieldBlock field={field} fieldName={fieldName} className={isFinancial ? "w-full md:col-span-6" : field.type === "MULTI_LINE" ? "md:col-span-2" : ""}>
                <JobField field={field} />
              </JobFieldBlock>
            )}

            {isFinancial && fieldName.toLowerCase().includes("discount") && <GrandTotal />}
          </React.Fragment>
        );
      })}

      {isFinancial && <OutstandingBalance />}
    </div>
  );
}
