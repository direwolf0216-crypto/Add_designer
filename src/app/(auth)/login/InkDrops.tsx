"use client";

import { motion, useTransform, type MotionValue } from "framer-motion";

type Drop = {
  /** Position in % of the hero area. */
  x: number;
  y: number;
  size: number;
  ink: "cyan" | "magenta" | "yellow" | "key" | "orange";
  /** 0 = far (small, soft, slow parallax) … 1 = near (sharp, fast parallax). */
  depth: number;
  shape?: "sphere" | "tear";
  /** Seconds for one float cycle, and its delay. */
  float: number;
  delay: number;
};

// Placed around the headline and the printer, clear of the text.
const DROPS: Drop[] = [
  { x: 82, y: 6, size: 46, ink: "magenta", depth: 0.9, float: 6.5, delay: 0 },
  { x: 92, y: 30, size: 18, ink: "cyan", depth: 0.35, float: 7.5, delay: 1.2 },
  { x: 93, y: 47, size: 30, ink: "yellow", depth: 0.7, shape: "tear", float: 5.8, delay: 0.6 },
  { x: 4, y: 58, size: 22, ink: "cyan", depth: 0.5, float: 6.8, delay: 2 },
  { x: 86, y: 70, size: 58, ink: "cyan", depth: 1, float: 7.2, delay: 0.3 },
  { x: 60, y: 92, size: 26, ink: "magenta", depth: 0.6, shape: "tear", float: 6.1, delay: 1.6 },
  { x: 96, y: 92, size: 14, ink: "key", depth: 0.25, float: 8.4, delay: 0.9 },
  { x: 48, y: 2, size: 12, ink: "orange", depth: 0.2, float: 9, delay: 2.4 },
  { x: 14, y: 96, size: 16, ink: "yellow", depth: 0.3, float: 7.8, delay: 1.1 },
];

function DropView({ d, px, py }: { d: Drop; px: MotionValue<number>; py: MotionValue<number> }) {
  // Parallax: nearer drops move further with the pointer.
  const range = 10 + d.depth * 34;
  const x = useTransform(px, [-1, 1], [-range, range]);
  const y = useTransform(py, [-1, 1], [-range * 0.7, range * 0.7]);
  const blur = d.depth < 0.4 ? (0.4 - d.depth) * 6 : 0;
  return (
    <motion.span
      className="absolute"
      style={{ left: `${d.x}%`, top: `${d.y}%`, x, y, zIndex: Math.round(d.depth * 10) }}
    >
      <span
        className={`ink-drop ink-${d.ink} ${d.shape === "tear" ? "ink-tear" : ""}`}
        style={{
          width: d.size,
          height: d.size,
          filter: blur ? `blur(${blur.toFixed(1)}px)` : undefined,
          animationDuration: `${d.float}s`,
          animationDelay: `-${d.delay}s`,
        }}
      />
    </motion.span>
  );
}

/** Glossy CMYK ink drops floating at different depths around the hero, parallaxing with the pointer. */
export default function InkDrops({ px, py }: { px: MotionValue<number>; py: MotionValue<number> }) {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      {DROPS.map((d, i) => (
        <DropView key={i} d={d} px={px} py={py} />
      ))}
    </div>
  );
}
