import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/** Gradient fills for icon tiles, shared across the dashboard (the brand's original palette). */
export const TONES = {
  slate: "from-slate-900 to-slate-700 shadow-slate-900/20",
  orange: "from-orange-500 to-pink-500 shadow-orange-500/30",
  emerald: "from-emerald-500 to-teal-500 shadow-emerald-500/30",
  rose: "from-rose-500 to-red-500 shadow-rose-500/30",
  sky: "from-sky-500 to-indigo-500 shadow-sky-500/30",
  violet: "from-violet-500 to-fuchsia-500 shadow-violet-500/30",
  amber: "from-amber-400 to-orange-500 shadow-amber-500/30",
} as const;
export type Tone = keyof typeof TONES;

export function IconTile({ icon, tone = "slate", size = "md" }: { icon: string; tone?: Tone; size?: "sm" | "md" | "lg" }) {
  const box = size === "sm" ? "h-8 w-8 rounded-xl text-[15px]" : size === "lg" ? "h-12 w-12 rounded-2xl text-[22px]" : "h-10 w-10 rounded-xl text-[18px]";
  return (
    <span className={cn("flex shrink-0 items-center justify-center bg-gradient-to-br text-white shadow-lg", box, TONES[tone])}>
      <i className={`ph-bold ${icon}`} aria-hidden="true"></i>
    </span>
  );
}

/** Glass card on the artwork: soft white, blur, 20px corners and an ambient shadow. */
export function GlassCard({
  icon, tone, title, subtitle, action, children, className,
}: {
  icon?: string;
  tone?: Tone;
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("dashboard-card p-5 sm:p-6", className)}>
      {title && (
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            {icon && <IconTile icon={icon} tone={tone} size="sm" />}
            <div className="min-w-0">
              <h2 className="truncate text-[1.05rem] font-extrabold tracking-tight text-slate-900">{title}</h2>
              {subtitle && <p className="truncate text-xs font-medium text-slate-500">{subtitle}</p>}
            </div>
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

/** A KPI tile: gradient icon, small label, big bold value and a caption. */
export function KpiTile({ icon, tone, label, value, caption, valueClass }: {
  icon: string;
  tone: Tone;
  label: string;
  value: ReactNode;
  caption?: ReactNode;
  valueClass?: string;
}) {
  return (
    <div className="dashboard-card group flex min-w-0 items-center gap-4 p-4 transition-transform duration-200 hover:-translate-y-0.5 2xl:p-5">
      <IconTile icon={icon} tone={tone} size="lg" />
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
        <p className={cn("num whitespace-nowrap text-[1.3rem] font-black leading-tight tracking-tight text-slate-900 2xl:text-[1.6rem]", valueClass)}>{value}</p>
        {caption && <p className="num truncate text-xs font-medium text-slate-500">{caption}</p>}
      </div>
    </div>
  );
}

/** Small "View all" style link in a card header. */
export function HeaderLink({ href, children, tone = "orange" }: { href: string; children: ReactNode; tone?: "orange" | "emerald" | "sky" }) {
  const color = tone === "emerald" ? "text-emerald-600 bg-emerald-50 hover:bg-emerald-100" : tone === "sky" ? "text-sky-600 bg-sky-50 hover:bg-sky-100" : "text-orange-600 bg-orange-50 hover:bg-orange-100";
  return (
    <Link href={href} className={cn("inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-xs font-bold transition-colors", color)}>
      {children}
      <i className="ph-bold ph-arrow-right text-[11px]" aria-hidden="true"></i>
    </Link>
  );
}
