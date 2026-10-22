"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useSession } from "next-auth/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { jobSchema, type JobFormData } from "@/lib/validations/job";
import { toLocalISODate } from "@/lib/dates";
import { JOB_FORM_FIELD_MAP } from "@/lib/forms/fieldMap";
import type { RepeatableData } from "@/lib/forms/types";
import { jobToFormState, layoutDefaults, newInstallment } from "@/lib/jobs/formMapping";
import { computeJobTotals, type FinancialRates, type Installment } from "@/lib/jobs/pricing";
import { useJobFormData } from "./useJobFormData";
import { usePricingRules } from "@/hooks/usePricingRules";

const INITIAL_VALUES: JobFormData = {
  title: "", category: "", date: "", time: "10:00 AM",
  location: "", phone: "", email: "", package: "", advance: "", due: "", status: "Confirmed",
  fld_print_quantity: "", fld_print_paper_type: "", fld_print_gsm: "", fld_print_size: "", fld_print_design: "",
};

/**
 * All job form state: the react-hook-form instance for flat fields plus the pieces kept outside it
 * (repeatable entries, per-entry rates, installments), pre-filled for edit/create and with the
 * financial values (advance, package, due) kept in sync.
 */
export function useJobFormState({ isOpen, jobToEditId, initialDate }: { isOpen: boolean; jobToEditId: string | null; initialDate: string | null }) {
  const form = useForm<JobFormData>({ resolver: zodResolver(jobSchema), defaultValues: INITIAL_VALUES });
  const { reset, setValue, watch, clearErrors } = form;

  const data = useJobFormData({ isOpen, jobToEditId, date: watch("date") });
  const userId = useSession().data?.user?.id ?? null;
  const { job, isJobLoading, layoutSchema } = data;

  const [isMultiInstallment, setIsMultiInstallment] = useState(false);
  const [installments, setInstallments] = useState<Installment[]>(() => [newInstallment()]);
  const [repeatableData, setRepeatableData] = useState<RepeatableData>({});
  const [financialRates, setFinancialRates] = useState<FinancialRates>({});
  const pricingRules = usePricingRules();
  /** User ids to assign, per Job Details entry (each entry becomes its own job on create). */
  const [entryAssignees, setEntryAssignees] = useState<string[][]>([[]]);

  // Edit mode pre-fill
  useEffect(() => {
    if (isOpen && !isJobLoading && job && layoutSchema) {
      const state = jobToFormState(job);
      setRepeatableData(state.repeatableData);
      if (state.financialRates !== undefined) setFinancialRates(state.financialRates);
      reset(state.values);
      setIsMultiInstallment(state.isMultiInstallment);
      setInstallments(state.installments);
      setEntryAssignees([((job as { assignments?: { userId: string }[] }).assignments ?? []).map((a) => a.userId)]);
    }
  }, [isOpen, job?.id, isJobLoading, reset, layoutSchema]); // eslint-disable-line react-hooks/exhaustive-deps -- re-fill only when a different job loads

  // Add mode default initialization
  useEffect(() => {
    if (isOpen && !isJobLoading && !jobToEditId) {
      const defaults = layoutDefaults(layoutSchema, JOB_FORM_FIELD_MAP, initialDate || toLocalISODate(), { userId });
      setRepeatableData(defaults.repeatableData);
      // Start clean: nothing may carry over from a job edited earlier (e.g. installment transaction ids).
      setFinancialRates({});
      setInstallments([newInstallment()]);
      setIsMultiInstallment(false);
      setEntryAssignees([[]]);
      reset(defaults.values);
      clearErrors();
    }
  }, [isOpen, jobToEditId, isJobLoading, initialDate, reset, clearErrors, layoutSchema, userId]);

  // Advance follows the installments, package follows line-item rates, due = package − advance.
  const packageValue = watch("package");
  const advanceValue = watch("advance");
  useEffect(() => {
    const totals = computeJobTotals({
      values: watch(),
      installments,
      repeatableData,
      financialRates,
      layout: layoutSchema,
      fieldMap: JOB_FORM_FIELD_MAP,
      rules: pricingRules,
    });
    if (totals.advance !== undefined) setValue("advance", totals.advance);
    if (totals.package !== undefined) setValue("package", totals.package);
    setValue("due", totals.due);
  }, [packageValue, advanceValue, installments, setValue, watch, repeatableData, financialRates, layoutSchema, pricingRules]);

  return {
    form,
    ...data,
    installments,
    setInstallments,
    isMultiInstallment,
    setIsMultiInstallment,
    repeatableData,
    setRepeatableData,
    financialRates,
    setFinancialRates,
    pricingRules,
    entryAssignees,
    setEntryAssignees,
  };
}

export type JobFormState = ReturnType<typeof useJobFormState>;
