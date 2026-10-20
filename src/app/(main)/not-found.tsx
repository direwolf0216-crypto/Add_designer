import Link from 'next/link';

export default function MainNotFound() {
  return (
    <div className="mx-auto mt-16 max-w-md rounded-2xl border border-slate-100 bg-white p-8 text-center shadow-sm">
      <h2 className="text-lg font-extrabold text-slate-900">Not found</h2>
      <p className="mt-1 text-sm text-slate-500">The page or record you&apos;re looking for doesn&apos;t exist or was deleted.</p>
      <Link href="/dashboard/overview" className="mt-6 inline-block rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800">
        Go to dashboard
      </Link>
    </div>
  );
}
