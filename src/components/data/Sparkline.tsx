/** Minimal line sparkline from real values (flat line when there's no data). */
export default function Sparkline({ values, stroke, id, className = "" }: { values: number[]; stroke: [string, string]; id: string; className?: string }) {
  const w = 120;
  const h = 40;
  const pts = values.length > 1 ? values : [0, 0];
  const max = Math.max(...pts);
  const min = Math.min(...pts);
  const range = max - min || 1;
  const d = pts
    .map((v, i) => `${i === 0 ? "M" : "L"} ${((i / (pts.length - 1)) * (w - 4) + 2).toFixed(1)} ${(h - 4 - ((v - min) / range) * (h - 8)).toFixed(1)}`)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={className} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={stroke[0]} />
          <stop offset="100%" stopColor={stroke[1]} />
        </linearGradient>
      </defs>
      <path d={d} fill="none" stroke={`url(#${id})`} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
