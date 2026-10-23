// Geometry for the printer loader's ink, computed once per module load from fixed seeds so the server
// and the browser draw exactly the same shapes (no hydration mismatch, no work per render).

/** Deterministic PRNG (mulberry32). */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const f1 = (n: number) => Math.round(n * 10) / 10;

/** A smooth closed path through points (Catmull-Rom turned into cubic Béziers). */
function smoothClosed(points: [number, number][]): string {
  const n = points.length;
  let d = `M${f1(points[0][0])} ${f1(points[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n];
    const p1 = points[i];
    const p2 = points[(i + 1) % n];
    const p3 = points[(i + 2) % n];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${f1(c1[0])} ${f1(c1[1])} ${f1(c2[0])} ${f1(c2[1])} ${f1(p2[0])} ${f1(p2[1])}`;
  }
  return `${d}Z`;
}

export interface Splat {
  /** The main puddle, with a few splash tendrils. */
  body: string;
  /** Satellite droplets thrown out by the impact. */
  drops: { cx: number; cy: number; r: number }[];
}

/**
 * An ink splat centred on 0,0 with radius about `r`: a lumpy puddle, a few thin tendrils where the
 * splash shot outwards, and droplets scattered around it.
 */
export function makeSplat(seed: number, r: number, tendrils = 5): Splat {
  const rand = rng(seed);
  const n = 34;
  const spikeAt = new Set(Array.from({ length: tendrils }, () => Math.floor(rand() * n)));
  const phase = rand() * Math.PI * 2;
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    // Low-frequency wobble keeps the puddle organic; tendrils are narrow single-point spikes.
    let rad = r * (0.86 + 0.1 * Math.sin(a * 3 + phase) + 0.08 * Math.sin(a * 5 - phase) + rand() * 0.08);
    if (spikeAt.has(i)) rad = r * (1.35 + rand() * 0.55);
    pts.push([Math.cos(a) * rad, Math.sin(a) * rad * 0.92]);
  }
  const drops = Array.from({ length: 7 }, () => {
    const a = rand() * Math.PI * 2;
    const dist = r * (1.35 + rand() * 1.1);
    return { cx: f1(Math.cos(a) * dist), cy: f1(Math.sin(a) * dist * 0.92), r: f1(r * (0.05 + rand() * 0.11)) };
  });
  return { body: smoothClosed(pts), drops };
}

/** A slow spreading pool (no splash): wide and gently lobed. */
export function makePool(seed: number, r: number): string {
  const rand = rng(seed);
  const n = 26;
  const phase = rand() * Math.PI * 2;
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rad = r * (0.8 + 0.16 * Math.sin(a * 2 + phase) + 0.1 * Math.sin(a * 4 - phase * 1.7) + rand() * 0.05);
    pts.push([Math.cos(a) * rad * 1.25, Math.sin(a) * rad * 0.8]);
  }
  return smoothClosed(pts);
}

export type Ink = "c" | "m" | "y" | "k";

/** Each drip: where it leaves the banner (x), when (delay), its ink, and the splat it makes. */
// Drips fall straight down from the roller (z = 69), so they land just in front of it.
export const DRIPS: { x: number; delay: number; ink: Ink; splat: Splat; landZ: number }[] = [
  { x: -70, delay: 0, ink: "m", splat: makeSplat(11, 17), landZ: 72 },
  { x: 34, delay: 0.9, ink: "c", splat: makeSplat(23, 14, 4), landZ: 70 },
  { x: -16, delay: 1.7, ink: "y", splat: makeSplat(37, 15, 6), landZ: 74 },
  { x: 74, delay: 2.5, ink: "k", splat: makeSplat(41, 12, 4), landZ: 71 },
  { x: -52, delay: 3.2, ink: "c", splat: makeSplat(53, 11, 3), landZ: 73 },
];

/** Ink that has pooled under the printer and keeps spreading. */
export const POOLS: { x: number; z: number; ink: Ink; d: string; delay: number }[] = [
  { x: -44, z: 96, ink: "m", d: makePool(7, 30), delay: 0 },
  { x: 36, z: 104, ink: "c", d: makePool(19, 26), delay: 2 },
  { x: -4, z: 116, ink: "y", d: makePool(29, 22), delay: 4 },
];
