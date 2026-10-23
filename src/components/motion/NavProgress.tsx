"use client";

import { Suspense, useCallback, useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import s from "./NavProgress.module.css";

const SHOW_AFTER = 120; // instant (prefetched) switches never flash the bar
const GIVE_UP_AFTER = 8_000; // a switch that never lands (cancelled, offline) stops the bar
const START_EVENT = "nav-progress:start";
// From the click until a while after the new page is in, entrance animations finish at once
// (html[data-arriving]): the page crossfade is the entrance, and a card still fading in mid-crossfade
// would let the background show through (a flash).
const ARRIVING_FOR = 2500;

/** Start the bar for a navigation that isn't a link click (router.push from a button). */
export function startNavProgress() {
  window.dispatchEvent(new Event(START_EVENT));
}

/** The link a click navigates with inside the app, or null. */
function internalLink(e: MouseEvent): HTMLAnchorElement | null {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return null;
  const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
  if (!a || a.target === "_blank" || a.hasAttribute("download")) return null;
  const url = new URL(a.href, location.href);
  if (url.origin !== location.origin) return null;
  return url.pathname + url.search !== location.pathname + location.search ? a : null;
}

function Bar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const ref = useRef<HTMLDivElement>(null);
  const timers = useRef<{ show?: number; stop?: number; arrived?: number }>({});

  const finish = useCallback(() => {
    const el = ref.current;
    window.clearTimeout(timers.current.show);
    window.clearTimeout(timers.current.stop);
    delete document.documentElement.dataset.navigating;
    window.clearTimeout(timers.current.arrived);
    if (document.documentElement.dataset.arriving) {
      timers.current.arrived = window.setTimeout(() => delete document.documentElement.dataset.arriving, ARRIVING_FOR);
    }
    if (el?.classList.contains(s.active)) {
      el.classList.remove(s.active);
      el.classList.add(s.done);
    }
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // A link can name what its switch replaces (data-nav-scope, e.g. just the jobs view); by default
    // that is the page's content.
    const start = (scope = "page") => {
      window.clearTimeout(timers.current.show);
      window.clearTimeout(timers.current.stop);
      window.clearTimeout(timers.current.arrived);
      document.documentElement.dataset.arriving = "true";
      timers.current.show = window.setTimeout(() => {
        el.classList.remove(s.done);
        el.classList.add(s.active);
        // While a switch is waiting, the content it replaces dims a little ([data-nav-dim]).
        document.documentElement.dataset.navigating = scope;
      }, SHOW_AFTER);
      timers.current.stop = window.setTimeout(finish, GIVE_UP_AFTER);
    };
    const onClick = (e: MouseEvent) => {
      const a = internalLink(e);
      if (a) start(a.dataset.navScope || "page");
    };
    const onStart = () => start();
    // Capture phase: Next's <Link> cancels the click's default action before it would bubble here.
    document.addEventListener("click", onClick, true);
    window.addEventListener(START_EVENT, onStart);
    // Back / forward: the page swaps like a click, and lands right away.
    const onPop = () => {
      document.documentElement.dataset.arriving = "true";
      finish();
    };
    window.addEventListener("popstate", onPop);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener(START_EVENT, onStart);
      window.removeEventListener("popstate", onPop);
    };
  }, [finish]);

  // The new page (or tab) is in: finish the bar.
  useEffect(() => {
    finish();
  }, [pathname, searchParams, finish]);

  return <div ref={ref} className={s.bar} aria-hidden="true" />;
}

/** A thin colour bar along the top while a page or tab switch is on its way. */
export default function NavProgress() {
  return (
    <Suspense fallback={null}>
      <Bar />
    </Suspense>
  );
}
