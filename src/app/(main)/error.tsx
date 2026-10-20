'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function MainError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className="mx-auto mt-16 max-w-md rounded-2xl border border-rose-100 bg-white p-8 text-center shadow-sm">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-rose-50 text-rose-500">
        <i className="ph-bold ph-warning-circle text-2xl" aria-hidden="true"></i>
      </div>
      <h2 className="text-lg font-extrabold text-slate-900">Something went wrong</h2>
      <p className="mt-1 text-sm text-slate-500">This page couldn&apos;t be loaded. Your data is safe — try again in a moment.</p>
      <div className="mt-6 flex justify-center gap-3">
        <button
          type="button"
          onClick={() => retry()}
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800"
        >
          Try again
        </button>
        <Link href="/dashboard/overview" className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">
          Go to dashboard
        </Link>
      </div>
    </div>
  );
}
