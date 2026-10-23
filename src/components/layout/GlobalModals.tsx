"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useSWRConfig } from "swr";
import { useGlobalForm } from "@/components/providers/GlobalFormProvider";

// The global modals are large (dynamic form engine, framer-motion), so they aren't part of the page's
// first download. Their code and the two form layouts are fetched once the page is idle instead, so
// the first New job / Add transaction opens at once (not after a download).
const loadJobForm = () => import("@/components/dashboard/JobFormModal");
const loadTransactionForm = () => import("@/components/dashboard/TransactionModal");
const loadTransactionDetails = () => import("@/components/dashboard/TransactionDetailsModal");
const JobFormModal = dynamic(loadJobForm, { ssr: false });
const TransactionModal = dynamic(loadTransactionForm, { ssr: false });
const TransactionDetailsModal = dynamic(loadTransactionDetails, { ssr: false });
const FORM_LAYOUTS = ["/api/settings/layouts/JOB_FORM", "/api/settings/layouts/TRANSACTION_FORM"];

export default function GlobalModals() {
  const { isJobFormOpen, isTransactionFormOpen, isTransactionDetailsOpen } = useGlobalForm();
  const [loaded, setLoaded] = useState({ job: false, tx: false, txDetails: false });
  const { cache, mutate } = useSWRConfig();

  useEffect(() => {
    const warm = () => {
      // Once their code is in, mount the (closed) dialogs: opening one is then just showing it. A
      // first open of a not-yet-mounted dialog waits ~300 ms (React holds back new content briefly).
      Promise.all([loadJobForm(), loadTransactionForm(), loadTransactionDetails()])
        .then(() => setLoaded({ job: true, tx: true, txDetails: true }))
        .catch(() => {});
      for (const key of FORM_LAYOUTS) {
        if (cache.get(key)?.data !== undefined) continue;
        mutate(
          key,
          fetch(key).then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status))))),
          { revalidate: false }
        ).catch(() => {});
      }
    };
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(warm, { timeout: 4000 });
      return () => window.cancelIdleCallback(id);
    }
    const t = setTimeout(warm, 2000);
    return () => clearTimeout(t);
  }, [cache, mutate]);

  // Latch "has been opened" during render (React's derived-state pattern) so close animations still play.
  if ((isJobFormOpen && !loaded.job) || (isTransactionFormOpen && !loaded.tx) || (isTransactionDetailsOpen && !loaded.txDetails)) {
    setLoaded({
      job: loaded.job || isJobFormOpen,
      tx: loaded.tx || isTransactionFormOpen,
      txDetails: loaded.txDetails || isTransactionDetailsOpen,
    });
  }

  return (
    <>
      {loaded.job && <JobFormModal />}
      {loaded.tx && <TransactionModal />}
      {loaded.txDetails && <TransactionDetailsModal />}
    </>
  );
}
