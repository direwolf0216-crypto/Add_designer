"use client";

import { useMemo } from "react";
import useSWR from "swr";
import { useGlobalForm } from "@/components/providers/GlobalFormProvider";
import { fetcher } from "@/lib/swr";
import { useLayoutPreview } from "@/components/providers/LayoutPreviewProvider";
import { withoutArchivedFields } from "@/lib/forms/archived";
import type { FormLayout } from "@/lib/forms/types";
import { isGroupId, type TransactionRecord } from "@/lib/transactions/formMapping";

/** Remote data for the transaction form: the record being edited (single or group), layout and Drive status. */
export function useTransactionFormData() {
  const { isTransactionFormOpen: isOpen, transactionToEditId, transactionInitialData } = useGlobalForm();

  const fetchUrl = transactionToEditId
    ? isGroupId(transactionToEditId)
      ? `/api/transactions/bulk/${transactionToEditId}`
      : `/api/transactions/${transactionToEditId}`
    : null;
  const { data: fetchRes, isLoading: isTxLoading } = useSWR<{ transaction?: TransactionRecord }>(fetchUrl, fetcher);

  // Until (or if) the fetch has no record, fall back to what the opener passed in.
  const fetchedTransaction = (fetchRes?.transaction || transactionInitialData) as TransactionRecord | undefined;
  const editTransaction = transactionToEditId ? fetchedTransaction : null;

  const { data: driveStatus } = useSWR<{ connected: boolean }>(isOpen ? "/api/integrations/google" : null, fetcher);
  const previewLayout: FormLayout | undefined = useLayoutPreview().layouts.TRANSACTION_FORM;
  const { data: layoutRes } = useSWR<{ schema?: FormLayout }>(isOpen && !previewLayout ? "/api/settings/layouts/TRANSACTION_FORM" : null, fetcher);

  const fetched = layoutRes?.schema;
  const layoutSchema = useMemo(() => withoutArchivedFields(previewLayout ?? fetched), [previewLayout, fetched]);
  return { editTransaction, isTxLoading, layoutSchema, driveStatus };
}
