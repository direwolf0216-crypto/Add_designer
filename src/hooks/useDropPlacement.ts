"use client";

import { useLayoutEffect, useState, type RefObject } from "react";

/**
 * Whether an absolutely positioned list under `anchorRef` should open upward: true when there is less room
 * below the anchor than the list needs (e.g. a picker near the bottom of a dialog). Re-measured while open.
 */
export function useDropPlacement(anchorRef: RefObject<HTMLElement | null>, open: boolean, listHeight = 270): "top" | "bottom" {
  const [placement, setPlacement] = useState<"top" | "bottom">("bottom");
  useLayoutEffect(() => {
    if (!open) return;
    const measure = () => {
      const el = anchorRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const below = window.innerHeight - r.bottom;
      setPlacement(below < listHeight && r.top > below ? "top" : "bottom");
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [anchorRef, open, listHeight]);
  return placement;
}
