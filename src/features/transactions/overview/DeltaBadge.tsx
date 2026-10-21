/** "↑ 12% vs last week" chip; neutral text when there's no previous-week baseline. */
export default function DeltaBadge({ change, label = "vs last week", invert = false }: { change: number | null; label?: string; invert?: boolean }) {
  if (change === null) {
    return <span className="shrink-0 rounded-xl bg-slate-100 px-2.5 py-1.5 text-xs font-bold text-slate-500">No data last week</span>;
  }
  const up = change >= 0;
  const good = invert ? !up : up;
  return (
    <span className={`flex shrink-0 items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-bold ${good ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"}`}>
      <i className={`ph-bold ${up ? "ph-arrow-up" : "ph-arrow-down"}`} aria-hidden="true"></i>
      {Math.abs(change)}% {label}
    </span>
  );
}
