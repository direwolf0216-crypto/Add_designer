import React from 'react';
import { useGlobalForm } from '@/components/providers/GlobalFormProvider';
import { usePermissions } from '@/hooks/usePermissions';

/** The dashboard's everyday actions: a new job, and one Add transaction (income or expense is picked in the form). */
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
        <button
          type="button"
          onClick={() => openTransactionForm()}
          className={`${base} bg-gradient-to-r from-orange-500 to-pink-500 text-white shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40`}
        >
          <i className="ph-bold ph-arrows-down-up text-[17px]" aria-hidden="true"></i>
          Add transaction
        </button>
      )}
    </>
  );
}
