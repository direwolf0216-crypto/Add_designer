"use client";

import { useMemo } from "react";
import { GlobalFormOverrideProvider } from "@/components/providers/GlobalFormProvider";
import { LayoutPreviewProvider } from "@/components/providers/LayoutPreviewProvider";
import JobFormDialog from "@/features/jobs/form/JobFormDialog";
import TransactionFormDialog from "@/features/transactions/form/TransactionFormDialog";
import type { FormLayout } from "@/lib/layout-builder/types";

/** Form keys the live preview can render with the real form components. */
export const PREVIEWABLE_FORMS = new Set(["JOB_FORM", "TRANSACTION_FORM"]);

/** Opens the real job or transaction form, rendered from the unsaved draft, with saving disabled. */
export default function LayoutPreviewDialog({ layout, open, onClose }: { layout: FormLayout; open: boolean; onClose: () => void }) {
  // The forms read a layout's schema (its sections), not the layout record.
  const layouts = useMemo(() => ({ [layout.formKey]: layout.schema as unknown as import("@/lib/forms/types").FormLayout }), [layout]);
  const override = useMemo(
    () =>
      layout.formKey === "JOB_FORM"
        ? { isJobFormOpen: open, jobToEditId: null, jobInitialDate: null, closeJobForm: onClose }
        : { isTransactionFormOpen: open, transactionToEditId: null, transactionInitialData: undefined, closeTransactionForm: onClose },
    [layout.formKey, open, onClose]
  );

  return (
    <GlobalFormOverrideProvider value={override}>
      <LayoutPreviewProvider layouts={layouts}>
        {layout.formKey === "JOB_FORM" ? <JobFormDialog /> : <TransactionFormDialog />}
      </LayoutPreviewProvider>
    </GlobalFormOverrideProvider>
  );
}
