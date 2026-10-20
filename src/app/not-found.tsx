import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex w-full items-center justify-center p-6">
      <div className="max-w-md rounded-2xl border border-slate-100 bg-white p-8 text-center shadow-sm">
        <h1 className="text-lg font-extrabold text-slate-900">Page not found</h1>
        <p className="mt-1 text-sm text-slate-500">Check the address, or head back to the dashboard.</p>
        <Link href="/dashboard/overview" className="mt-6 inline-block rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800">
          Go to dashboard
        </Link>
      </div>
    </div>
  );
}
