import React from 'react';
import { useGlobalForm } from '@/components/providers/GlobalFormProvider';
import { usePermissions } from '@/hooks/usePermissions';

/** The dashboard's three everyday actions, sized to sit in the header row beside the period picker. */
export default function QuickActions() {
  const { openJobForm, openTransactionForm } = useGlobalForm();
  const { checkPermission } = usePermissions();

  const canManageJobs = checkPermission('create_jobs');
  const canManageTransactions = checkPermission('create_transactions');

  const base = 'inline-flex h-11 shrink-0 items-center gap-2 rounded-2xl px-4 text-[0.95rem] font-bold transition-[transform,box-shadow,background-color] duration-200 hover:-translate-y-0.5 active:scale-[0.98]';

  return (
    <>
      {canManageJobs && (
        <button
          type="button"
          onClick={() => openJobForm()}
          className={`${base} bg-[#1e2338] text-white shadow-lg shadow-slate-900/15 hover:bg-[#2a3048]`}
        >
          <i className="ph-bold ph-plus text-[16px]" aria-hidden="true"></i>
          New job
        </button>
      )}
      {canManageTransactions && (
        <>
          <button
            type="button"
            onClick={() => openTransactionForm(undefined, { type: 'EXPENSE' })}
            className={`${base} border border-red-100 bg-red-50 text-red-500 hover:bg-red-100`}
          >
            <i className="ph-bold ph-receipt text-[17px]" aria-hidden="true"></i>
            Expense
          </button>
          <button
            type="button"
            onClick={() => openTransactionForm(undefined, { type: 'INCOME' })}
            className={`${base} border border-emerald-100 bg-emerald-50 text-emerald-600 hover:bg-emerald-100`}
          >
            <i className="ph-bold ph-money text-[17px]" aria-hidden="true"></i>
            Income
          </button>
        </>
      )}
    </>
  );
}
