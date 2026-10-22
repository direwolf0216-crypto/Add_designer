import Link from "next/link";
import PageReveal from "@/components/motion/PageReveal";

/** Shown to someone whose role has no view permission for any section yet. */
export default function NoAccessPage() {
  return (
    <PageReveal>
      <div className="mx-auto flex min-h-[60dvh] w-full max-w-md flex-col items-center justify-center text-center">
        <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-orange-500 shadow-sm ring-1 ring-slate-100">
          <i className="ph-bold ph-lock-key text-2xl" aria-hidden="true"></i>
        </span>
        <h1 className="text-xl font-extrabold text-slate-900">Nothing to show yet</h1>
        <p className="mt-2 text-sm font-medium text-slate-500">
          Your role doesn&apos;t include access to Jobs, the Daily Ledger or the Dashboard. Ask an admin to grant a permission, then refresh.
        </p>
        <Link href="/login" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800">
          <i className="ph-bold ph-arrow-clockwise" aria-hidden="true"></i>
          Refresh
        </Link>
      </div>
    </PageReveal>
  );
}
