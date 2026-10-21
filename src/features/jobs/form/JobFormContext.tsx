"use client";

import { createContext, useContext } from "react";
import type { UserItem } from "@/components/ui/MultiUserPicklist";
import type { IsVisible } from "@/lib/jobs/formMapping";
import type { JobFormState } from "./useJobFormState";

export interface JobFormContextValue extends JobFormState {
  /** Visibility of a section/field rule against the current form values. */
  isVisible: IsVisible;
  /** Staff with `isBusy` for the form's current date/time. */
  usersWithAvailability: (UserItem & { isBusy: boolean })[];
  /** Repeatable entry awaiting "Remove this entry?" confirmation (one at a time across sections). */
  deleteConfirm: { sectionId: string; index: number } | null;
  setDeleteConfirm: (value: { sectionId: string; index: number } | null) => void;
}

const JobFormContext = createContext<JobFormContextValue | null>(null);

export const JobFormProvider = JobFormContext.Provider;

/** Job form state for components rendered inside JobFormDialog (sections, editors, extras). */
export function useJobFormContext(): JobFormContextValue {
  const ctx = useContext(JobFormContext);
  if (!ctx) throw new Error("useJobFormContext must be used inside JobFormDialog");
  return ctx;
}
