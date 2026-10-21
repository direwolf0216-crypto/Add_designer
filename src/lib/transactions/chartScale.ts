// Axis helpers for the small overview charts. Pure.

/** Round `value` up to a "nice" number (1, 2, 2.5, 5 × 10^n). */
export function niceCeil(value: number): number {
  if (value <= 0) return 0;
  const exp = Math.floor(Math.log10(value));
  const base = 10 ** exp;
  const f = value / base;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return nice * base;
}

/** Evenly spaced "nice" ticks covering min (≤0) .. max (≥0), largest first; always includes 0. */
export function niceTicks(min: number, max: number, count = 5): number[] {
  const hi = Math.max(max, 0);
  const lo = Math.min(min, 0);
  const step = niceCeil((niceCeil(hi) - (lo < 0 ? -niceCeil(-lo) : 0)) / count) || 1;
  const top = Math.max(step, Math.ceil(hi / step) * step);
  const bottom = Math.floor(lo / step) * step;
  const ticks: number[] = [];
  for (let t = top; t >= bottom - step / 2; t -= step) ticks.push(Math.round(t));
  return ticks;
}
