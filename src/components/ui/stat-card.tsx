import Link from "next/link";

const TONES = {
  slate: "from-slate-900 to-slate-700 text-white shadow-slate-900/20",
  orange: "from-orange-500 to-pink-500 text-white shadow-orange-500/25",
  emerald: "from-emerald-500 to-teal-500 text-white shadow-emerald-500/25",
  rose: "from-rose-500 to-red-500 text-white shadow-rose-500/25",
  sky: "from-sky-500 to-indigo-500 text-white shadow-sky-500/25",
} as const;

/** KPI tile; renders as a link when `href` is set (selected state for filter tiles). */
export default function StatCard({
  icon, label, value, tone = "slate", href, selected,
}: { icon: string; label: string; value: number | string; tone?: keyof typeof TONES; href?: string; selected?: boolean }) {
  const body = (
    <div className={`group flex items-center gap-4 rounded-3xl border bg-white/80 p-4 backdrop-blur transition-all ${selected ? "border-slate-900 shadow-[0_10px_30px_-12px_rgba(15,23,42,0.35)]" : "border-slate-200/80 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_-14px_rgba(15,23,42,0.25)]"}`}>
      <span className={`flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br shadow-lg ${TONES[tone]}`}>
        <i className={`ph-bold ${icon} text-lg`} aria-hidden="true"></i>
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
        <p className="text-2xl font-black tracking-tight text-slate-900">{value}</p>
      </div>
    </div>
  );
  return href ? (
    <Link href={href} aria-current={selected ? "page" : undefined} className="rounded-3xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400">
      {body}
    </Link>
  ) : body;
}
