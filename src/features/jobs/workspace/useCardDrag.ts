"use client";

import { useCallback, useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";

type Options = {
  /** The column under the pointer while a card is held (its `data-board-column`), or null. */
  onTarget: (stage: string | null) => void;
  /** A card was dropped on another column. */
  onDrop: (jobId: string, stage: string) => void;
};

const MOUSE_SLOP = 5; // px a mouse moves before a press becomes a drag (a shorter press is a click)
const TOUCH_HOLD = 260; // ms a finger rests on a card before it lifts (sooner moves scroll instead)
const TOUCH_SLOP = 8;
const EDGE = 64; // px from the board's side where it scrolls itself
const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

/**
 * Drag a board card with the mouse or a finger: the card itself lifts and follows the pointer (a
 * faded placeholder keeps its place), the column under it lights up, and dropping on another column
 * moves the job; anywhere else the card glides back. Works on touch screens (press and hold), and
 * the board scrolls sideways when the card nears its edge.
 */
export function useCardDrag({ onTarget, onDrop }: Options) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const opts = useRef({ onTarget, onDrop });
  useEffect(() => {
    opts.current = { onTarget, onDrop };
  });
  const cleanup = useRef<(() => void) | null>(null);
  useEffect(() => () => cleanup.current?.(), []);
  // A finger holding a card must not scroll the board. Browsers only let a touch listener stop
  // scrolling if it was there when the finger came down, so it lives on the board from the start.
  const holding = useRef<"no" | "pressing" | "dragging">("no");
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const onTouchMove = (ev: TouchEvent) => {
      if (holding.current === "dragging") ev.preventDefault();
    };
    const onContextMenu = (ev: Event) => {
      if (holding.current !== "no") ev.preventDefault();
    };
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("contextmenu", onContextMenu);
    return () => {
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("contextmenu", onContextMenu);
    };
  }, []);

  const onCardPointerDown = useCallback((e: ReactPointerEvent<HTMLElement>, jobId: string, fromStage: string) => {
    if (e.button !== 0 || (e.target as Element).closest("[data-no-drag]")) return;
    const card = e.currentTarget;
    const touch = e.pointerType === "touch";
    const startX = e.clientX;
    const startY = e.clientY;
    let x = startX;
    let y = startY;
    let dragging = false;
    let ghost: HTMLElement | null = null;
    let target: string | null = null;
    let raf = 0;
    let hold = 0;
    const scroller = scrollerRef.current;
    const rect = card.getBoundingClientRect();

    const frame = () => {
      raf = 0;
      if (!ghost) return;
      ghost.style.transform = `translate(${x - startX}px, ${y - startY}px) rotate(2deg) scale(1.03)`;
      const under = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-board-column]");
      const next = under?.dataset.boardColumn ?? null;
      if (next !== target) {
        target = next;
        opts.current.onTarget(next === fromStage ? null : next);
      }
      // Near the board's left or right edge, scroll it towards the pointer.
      if (scroller) {
        const r = scroller.getBoundingClientRect();
        const dx = x < r.left + EDGE ? -1 : x > r.right - EDGE ? 1 : 0;
        if (dx) {
          scroller.scrollLeft += dx * 14;
          raf = requestAnimationFrame(frame);
        }
      }
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(frame);
    };

    const lift = () => {
      dragging = true;
      holding.current = "dragging";
      ghost = card.cloneNode(true) as HTMLElement;
      ghost.removeAttribute("id");
      ghost.setAttribute("aria-hidden", "true");
      Object.assign(ghost.style, {
        position: "fixed",
        left: `${rect.left}px`,
        top: `${rect.top}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
        margin: "0",
        zIndex: "300",
        pointerEvents: "none",
        cursor: "grabbing",
        transition: `box-shadow 0.2s ${EASE}`,
        boxShadow: "0 28px 60px -20px rgba(15,23,42,0.45), 0 8px 20px -10px rgba(15,23,42,0.25)",
        willChange: "transform",
      });
      document.body.appendChild(ghost);
      card.style.transition = "opacity 0.2s ease";
      card.style.opacity = "0.35";
      document.body.style.userSelect = "none";
      document.body.style.cursor = "grabbing";
      if (scroller) scroller.style.scrollSnapType = "none";
      if (touch && navigator.vibrate) navigator.vibrate(10);
      schedule();
    };

    const end = (drop: boolean) => {
      window.clearTimeout(hold);
      holding.current = "no";
      if (raf) cancelAnimationFrame(raf);
      remove();
      if (!dragging) return;
      // The click that follows a drag must not open the job.
      const swallow = (ev: MouseEvent) => {
        ev.preventDefault();
        ev.stopPropagation();
      };
      window.addEventListener("click", swallow, { capture: true, once: true });
      window.setTimeout(() => window.removeEventListener("click", swallow, { capture: true }), 0);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      if (scroller) scroller.style.scrollSnapType = "";
      opts.current.onTarget(null);
      const g = ghost;
      const moved = drop && target && target !== fromStage;
      if (g) {
        if (moved) {
          // Dropped: the card settles into its new column (it appears there at once).
          g.style.transition = `opacity 0.18s ease, transform 0.18s ${EASE}`;
          g.style.opacity = "0";
          g.style.transform = `translate(${x - startX}px, ${y - startY}px) scale(0.96)`;
        } else {
          // Not dropped on another column: glide back to where it came from.
          g.style.transition = `transform 0.3s ${EASE}, box-shadow 0.3s ${EASE}`;
          g.style.transform = "none";
          g.style.boxShadow = "";
        }
        window.setTimeout(() => {
          g.remove();
          card.style.opacity = "";
        }, moved ? 180 : 300);
      }
      if (moved) opts.current.onDrop(jobId, target!);
    };

    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== e.pointerId) return;
      x = ev.clientX;
      y = ev.clientY;
      const far = Math.hypot(x - startX, y - startY);
      if (!dragging) {
        if (touch) {
          if (far > TOUCH_SLOP) end(false); // the finger is scrolling, not holding
        } else if (far > MOUSE_SLOP) {
          lift();
        }
        return;
      }
      schedule();
    };
    const onUp = (ev: PointerEvent) => ev.pointerId === e.pointerId && end(true);
    const onCancel = (ev: PointerEvent) => ev.pointerId === e.pointerId && end(false);
    const onKey = (ev: KeyboardEvent) => ev.key === "Escape" && end(false);

    const remove = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      window.removeEventListener("keydown", onKey);
      cleanup.current = null;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    window.addEventListener("keydown", onKey);
    cleanup.current = () => end(false);
    if (touch) {
      holding.current = "pressing";
      hold = window.setTimeout(lift, TOUCH_HOLD);
    }
  }, []);

  return { scrollerRef, onCardPointerDown };
}
