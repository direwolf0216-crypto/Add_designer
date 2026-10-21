import Link from "next/link";
import { GlassCard } from "./vibrant";

type Stage = { stage: string; count: number };

/** Each board stage gets its own gradient and icon, read from its name. */
function look(label: string, index: number) {
  const l = label.toLowerCase();
  if (/ready/.test(l)) return { bar: "from-emerald-400 to-teal-500", tile: "from-emerald-500 to-teal-500 shadow-emerald-500/30", icon: "ph-package" };
  if (/design/.test(l) && /complet/.test(l)) return { bar: "from-violet-400 to-purple-500", tile: "from-violet-500 to-purple-600 shadow-violet-500/30", icon: "ph-check-square-offset" };
  if (/print/.test(l)) return { bar: "from-sky-400 to-indigo-500", tile: "from-sky-500 to-indigo-500 shadow-sky-500/30", icon: "ph-printer" };
  if (/design/.test(l)) return { bar: "from-pink-400 to-fuchsia-500", tile: "from-pink-500 to-fuchsia-500 shadow-pink-500/30", icon: "ph-paint-brush-broad" };
  if (/pending|new|confirm/.test(l) || index === 0) return { bar: "from-amber-300 to-orange-500", tile: "from-amber-400 to-orange-500 shadow-amber-500/30", icon: "ph-hourglass-medium" };
  return { bar: "from-violet-400 to-purple-500", tile: "from-violet-500 to-purple-500 shadow-violet-500/30", icon: "ph-gear-six" };
}

/** The press pipeline: every open job as one bar split by board stage, with a tile per stage under it. */
export default function PressPipeline({ stages }: { stages: Stage[] }) {
  const open = stages.reduce((sum, s) => sum + s.count, 0);
  const share = (n: number) => (open > 0 ? Math.round((n / open) * 100) : 0);

  return (
    <GlassCard
      icon="ph-kanban"
      tone="violet"
      title="Press pipeline"
      subtitle={`${open.toLocaleString("en-IN")} open jobs by stage`}
      action={
        <Link href="/jobs" className="inline-flex shrink-0 items-center gap-1 rounded-full bg-violet-50 px-3 py-1 text-xs font-bold text-violet-600 transition-colors hover:bg-violet-100">
          Open board
          <i className="ph-bold ph-arrow-right text-[11px]" aria-hidden="true"></i>
        </Link>
      }
    >
      {open === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-3 text-sm font-medium text-slate-500">
          No open jobs. New bookings start in {stages[0]?.stage ?? "the first stage"}.
        </p>
      ) : (
        <>
          <div
            className="flex h-4 w-full gap-1 overflow-hidden rounded-full bg-slate-100 p-0.5"
            role="img"
            aria-label={stages.map((s) => `${s.stage} ${s.count}`).join(", ")}
          >
            {stages.filter((s) => s.count > 0).map((s) => (
              <span
                key={s.stage}
                className={`h-full rounded-full bg-gradient-to-r ${look(s.stage, stages.indexOf(s)).bar}`}
                style={{ flexGrow: s.count, flexBasis: 0 }}
              />
            ))}
          </div>

          <ul className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-[repeat(auto-fit,minmax(150px,1fr))]">
            {stages.map((s, i) => {
              const l = look(s.stage, i);
              return (
                <li key={s.stage}>
                  <Link
                    href={`/jobs?view=list&stages=${encodeURIComponent(s.stage)}`}
                    className="group flex items-center gap-3 rounded-2xl border border-slate-100 bg-white/70 p-3 transition-[box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-lg ${l.tile}`}>
                      <i className={`ph-bold ${l.icon} text-[18px]`} aria-hidden="true"></i>
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-semibold text-slate-500">{s.stage}</span>
                      <span className="flex items-baseline gap-1.5">
                        <span className="num text-xl font-black tracking-tight text-slate-900">{s.count.toLocaleString("en-IN")}</span>
                        <span className="num text-xs font-bold text-slate-400">{share(s.count)}%</span>
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </GlassCard>
  );
}
