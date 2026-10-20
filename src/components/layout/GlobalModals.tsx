"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useGlobalForm } from "@/components/providers/GlobalFormProvider";

// The global modals are large (dynamic form engine, framer-motion). Load each one's code only the
// first time it is opened instead of on every page.
const JobFormModal = dynamic(() => import("@/components/dashboard/JobFormModal"), { ssr: false });
const TransactionModal = dynamic(() => import("@/components/dashboard/TransactionModal"), { ssr: false });
const TransactionDetailsModal = dynamic(() => import("@/components/dashboard/TransactionDetailsModal"), { ssr: false });

export default function GlobalModals() {
  const { isJobFormOpen, isTransactionFormOpen, isTransactionDetailsOpen } = useGlobalForm();
  const [loaded, setLoaded] = useState({ job: false, tx: false, txDetails: false });

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
