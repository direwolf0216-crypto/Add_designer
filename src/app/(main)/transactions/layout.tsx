"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, ViewTransition, useState } from "react";
import { useSlidingPill } from "@/components/motion/useSlidingPill";
import PrinterLoader from "@/components/motion/PrinterLoader";
import { useGlobalForm } from "@/components/providers/GlobalFormProvider";
import { usePermissions } from "@/hooks/usePermissions";

function TransactionsLayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "";
  const router = useRouter();
  const { openTransactionForm } = useGlobalForm();
  const { checkPermission } = usePermissions();
  const canCreate = checkPermission("create_transactions");

  // The clicked tab lights up at once (the highlight glides over); the real path takes over after.
  const [picked, setPicked] = useState<{ from: string; to: string } | null>(null);
  if (picked && picked.from !== pathname) setPicked(null);
  const shown = picked ? picked.to : pathname;
  const isOverview = shown === "/transactions/overview";
  const isAll = shown === "/transactions/allTransactions";
  const { ref: pillRef, style: pillStyle } = useSlidingPill<HTMLDivElement>(isOverview ? "overview" : isAll ? "all" : null);
  const pick = (to: string) => (e: React.MouseEvent) => {
    if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && to !== pathname) setPicked({ from: pathname, to });
  };

  return (
    <div className="p-0 md:p-4 lg:p-8 pb-20 animate-fade-in w-full max-w-7xl mx-auto">
      {/* Tab Navigation: fades with the page when you arrive or leave; stays put between the two tabs. */}
      <ViewTransition enter="soft-in" exit="soft-out" default="none">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-7">
        <div ref={pillRef} className="relative flex items-center bg-white border border-slate-200 rounded-2xl p-1 shadow-sm overflow-x-auto no-scrollbar w-full sm:w-auto">
          {pillStyle && <span aria-hidden="true" data-sliding-pill className="rounded-xl bg-slate-900 shadow-md" style={pillStyle} />}
          <Link
            href="/transactions/overview"
            prefetch={true}
            data-pill-key="overview"
            onClick={pick("/transactions/overview")}
            className={`relative z-10 px-5 py-2.5 rounded-xl font-bold text-sm transition-colors duration-300 ${
              isOverview ? "text-white" : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            Overview
          </Link>
          <Link
            href="/transactions/allTransactions"
            prefetch={true}
            data-pill-key="all"
            onClick={pick("/transactions/allTransactions")}
            className={`relative z-10 px-5 py-2.5 rounded-xl font-bold text-sm transition-colors duration-300 ${
              isAll ? "text-white" : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            All Transactions
          </Link>
        </div>

        {canCreate && (
        <div className="sm:ml-auto w-full sm:w-auto">
          <button
            onClick={() => openTransactionForm()}
            className="bg-orange-500 hover:bg-orange-600 text-white w-full sm:w-auto px-6 h-[44px] rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-orange-500/25 transition-all hover:-translate-y-0.5 hover:shadow-orange-500/40 active:scale-95 whitespace-nowrap"
          >
            <i className="ph-bold ph-plus text-base"></i>
            Add Transaction
          </button>
        </div>
        )}
      </div>
      </ViewTransition>

      <div>{children}</div>
    </div>
  );
}

export default function TransactionsLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<PrinterLoader label="Printing your ledger" />}>
      <TransactionsLayoutContent>{children}</TransactionsLayoutContent>
    </Suspense>
  );
}
