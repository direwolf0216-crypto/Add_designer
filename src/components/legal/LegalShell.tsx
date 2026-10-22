import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import type { LegalBusiness } from "@/lib/legal/business";

export type LegalSection = { id: string; title: string; body: ReactNode };

/**
 * Frame shared by the privacy and terms pages: brand header, "last updated", a jump list of sections
 * (inline on phones, a sticky rail on wide screens) and the shop's contact details at the end.
 */
export default function LegalShell({
  eyebrow, title, intro, updated, sections, business, otherHref, otherLabel,
}: {
  eyebrow: string;
  title: string;
  intro: ReactNode;
  updated: string;
  sections: LegalSection[];
  business: LegalBusiness;
  otherHref: string;
  otherLabel: string;
}) {
  return (
    <article className="overflow-hidden rounded-[1.75rem] border border-white/60 bg-white/95 text-slate-800 shadow-[0_25px_70px_rgba(0,0,0,0.45)] backdrop-blur-2xl sm:rounded-[2.2rem]">
      <header className="border-b border-slate-100 px-5 py-6 sm:px-10 sm:py-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/login" className="inline-flex items-center" aria-label="Back to sign in">
            <Image unoptimized src="/assets/logo.png?v=2" alt={business.name} width={340} height={90} className="h-auto w-[170px] object-contain sm:w-[220px]" />
          </Link>
          <nav aria-label="Legal pages" className="flex items-center gap-2 text-sm font-semibold">
            <Link href={otherHref} className="rounded-full border border-slate-200 px-3.5 py-1.5 text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-900">
              {otherLabel}
            </Link>
            <Link href="/login" className="rounded-full bg-gradient-to-r from-[#ff007f] via-[#ff5500] to-[#ff9f1c] px-3.5 py-1.5 text-white shadow-md shadow-pink-500/20">
              Sign in
            </Link>
          </nav>
        </div>
        <p className="mt-6 text-[0.7rem] font-bold uppercase tracking-[0.18em] text-orange-500">{eyebrow}</p>
        <h1 className="mt-1.5 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">{title}</h1>
        <div className="mt-3 max-w-2xl text-[0.95rem] leading-relaxed text-slate-600">{intro}</div>
        <p className="mt-4 text-xs font-semibold text-slate-400">Last updated {updated}</p>
      </header>

      <div className="grid gap-8 px-5 py-6 sm:px-10 sm:py-8 lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-12">
        <nav aria-label="On this page" className="lg:sticky lg:top-6 lg:self-start">
          <p className="mb-2 text-[0.65rem] font-extrabold uppercase tracking-wider text-slate-400">On this page</p>
          <ol className="flex flex-wrap gap-1.5 lg:flex-col lg:gap-0.5">
            {sections.map((s, i) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="inline-flex items-center gap-2 rounded-lg px-2 py-1 text-[0.8rem] font-semibold text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900">
                  <span className="font-mono text-[0.65rem] text-slate-300">{String(i + 1).padStart(2, "0")}</span>
                  {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="min-w-0">
          {sections.map((s, i) => (
            <section key={s.id} id={s.id} className="scroll-mt-6 border-b border-slate-100 py-6 first:pt-0 last:border-0">
              <h2 className="flex items-baseline gap-3 text-lg font-extrabold tracking-tight text-slate-900">
                <span className="font-mono text-xs font-bold text-orange-400">{String(i + 1).padStart(2, "0")}</span>
                {s.title}
              </h2>
              <div className="legal-prose mt-3 text-[0.925rem] leading-relaxed text-slate-600">{s.body}</div>
            </section>
          ))}

          <section id="contact" className="mt-6 rounded-2xl border border-orange-100 bg-gradient-to-br from-orange-50/80 to-white p-5">
            <h2 className="text-base font-extrabold text-slate-900">Questions? Talk to us.</h2>
            <dl className="mt-3 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
              <div><dt className="text-xs font-bold uppercase tracking-wider text-slate-400">Business</dt><dd className="font-semibold text-slate-800">{business.name}</dd></div>
              <div><dt className="text-xs font-bold uppercase tracking-wider text-slate-400">Email</dt><dd><a href={`mailto:${business.email}`} className="font-semibold text-orange-600 hover:underline">{business.email}</a></dd></div>
              <div><dt className="text-xs font-bold uppercase tracking-wider text-slate-400">Phone</dt><dd><a href={`tel:${business.phone.replace(/\s+/g, "")}`} className="font-semibold text-slate-800">{business.phone}</a></dd></div>
              <div><dt className="text-xs font-bold uppercase tracking-wider text-slate-400">Address</dt><dd className="font-semibold text-slate-800">{business.address}</dd></div>
            </dl>
          </section>
        </div>
      </div>
    </article>
  );
}
