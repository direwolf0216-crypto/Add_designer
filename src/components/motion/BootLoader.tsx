"use client";

import { useEffect, useRef, useState } from "react";
import PrinterLoader from "./PrinterLoader";
import s from "./BootLoader.module.css";

// Steps aside the moment the page's HTML has arrived (DOMContentLoaded), without waiting for images or
// the app's scripts, so even on a slow (3G) connection the server-rendered page shows right away. A
// tiny inline script does that before React loads; React then removes the overlay.
const HIDE_WHEN_PARSED = `(function(){function h(){var e=document.querySelector('[data-boot-loader]');if(e)e.setAttribute('data-boot-loader','off')}if(document.readyState!=='loading')h();else document.addEventListener('DOMContentLoaded',h,{once:true});setTimeout(h,2500)})();`;

/**
 * The printer loader over the whole screen for the first moment of a page refresh (or first visit),
 * until the page's HTML is in. It's in the server HTML, so it shows before any script runs.
 */
export default function BootLoader({ nonce }: { nonce?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.dataset.bootLoader = "off";
    const t = window.setTimeout(() => setGone(true), 400);
    return () => window.clearTimeout(t);
  }, []);

  if (gone) return null;
  return (
    <>
      {/* The inline script flips this to "off" before React hydrates; that's expected. */}
      <div ref={ref} className={s.overlay} data-boot-loader="on" suppressHydrationWarning>
        <PrinterLoader />
      </div>
      {/* Carries the request's CSP nonce, or the policy would block it. */}
      <script nonce={nonce} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: HIDE_WHEN_PARSED }} />
    </>
  );
}
