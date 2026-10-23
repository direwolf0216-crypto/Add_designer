"use client";

import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";

/**
 * One highlight that glides to the active item of a tab row or menu, instead of each item switching
 * its own background. Mark items with `data-pill-key`; render the returned style on an absolutely
 * positioned element inside the container (behind the items). It places itself without gliding the
 * first time and when the container resizes, and glides when the active item changes.
 */
export function useSlidingPill<T extends HTMLElement>(activeKey: string | null | undefined) {
  const ref = useRef<T>(null);
  const [box, setBox] = useState<{ x: number; y: number; w: number; h: number; glide: boolean } | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const place = (glide: boolean) => {
      const item = activeKey != null ? el.querySelector<HTMLElement>(`[data-pill-key="${CSS.escape(activeKey)}"]`) : null;
      if (!item) return setBox(null);
      const c = el.getBoundingClientRect();
      const r = item.getBoundingClientRect();
      setBox((prev) => ({ x: r.left - c.left + el.scrollLeft, y: r.top - c.top + el.scrollTop, w: r.width, h: r.height, glide: glide && prev !== null }));
    };
    place(true);
    // Only a real resize repositions without gliding (the observer also fires once on attach, which
    // must not cancel the glide that just started).
    let size = `${el.offsetWidth}x${el.offsetHeight}`;
    const ro = new ResizeObserver(() => {
      const next = `${el.offsetWidth}x${el.offsetHeight}`;
      if (next === size) return;
      size = next;
      place(false);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [activeKey]);

  const style: CSSProperties | undefined = box
    ? {
        position: "absolute",
        left: 0,
        top: 0,
        width: box.w,
        height: box.h,
        transform: `translate(${box.x}px, ${box.y}px)`,
        transition: box.glide
          ? "transform 0.45s cubic-bezier(0.22, 1, 0.36, 1), width 0.45s cubic-bezier(0.22, 1, 0.36, 1), height 0.45s cubic-bezier(0.22, 1, 0.36, 1), background-color 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease"
          : "none",
        pointerEvents: "none",
      }
    : undefined;
  return { ref, style };
}
