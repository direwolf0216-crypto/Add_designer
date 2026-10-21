"use client";

import { Suspense } from "react";
import { TransactionsList } from "@/features/transactions/list/TransactionsList";
import { TransactionListSkeleton } from "@/features/transactions/list/TransactionListSkeleton";

export default function TransactionsClient() {
  return (
    <Suspense fallback={<TransactionListSkeleton className="p-8" />}>
      <TransactionsList />
    </Suspense>
  );
}
