"use client";

import type { ReactNode } from "react";
import { useSlidingPill } from "./useSlidingPill";

/**
 * A group of options (tabs, a segmented filter, a list to pick from) whose active highlight glides
 * to the picked option instead of jumping. Mark each option with `data-pill-key` and give it
 * `relative z-10` and no active background of its own; `pillClassName` is the highlight's look.
 */
export default function GlideGroup({
  active,
  pillClassName,
  className = "",
  as = "div",
  children,
  ...rest
}: {
  active: string | null | undefined;
  pillClassName: string;
  className?: string;
  as?: "div" | "nav" | "ul";
  children: ReactNode;
} & Partial<Record<`aria-${string}` | "role", string>>) {
  const { ref, style } = useSlidingPill<HTMLDivElement>(active);
  const Tag = as as "div";
  return (
    <Tag ref={ref} className={`relative ${className}`} {...rest}>
      {style && <span aria-hidden="true" data-sliding-pill className={pillClassName} style={style} />}
      {children}
    </Tag>
  );
}
