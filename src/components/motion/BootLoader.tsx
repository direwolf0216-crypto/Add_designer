"use client";

import { useEffect, useRef, useState } from "react";
import PrinterLoader from "./PrinterLoader";
import s from "./BootLoader.module.css";

/**
 * The printer loader over the whole screen from the first paint of a page refresh (or first visit)
 * until the app is ready, like the flex-printer-loader sample. It is in the server HTML, so it shows
 * before any script runs, fades out once the page is interactive, then leaves the DOM.
 */
export default function BootLoader() {
  const ref = useRef<HTMLDivElement>(null);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const finish = () => {
      el.classList.add(s.done);
      window.setTimeout(() => setGone(true), 400);
    };
    // Wait for the page's own resources too, as the sample did; never longer than a few seconds.
    if (document.readyState === "complete") finish();
    else window.addEventListener("load", finish, { once: true });
    const cap = window.setTimeout(finish, 6000);
    return () => {
      window.removeEventListener("load", finish);
      window.clearTimeout(cap);
    };
  }, []);

  if (gone) return null;
  return (
    <div ref={ref} className={s.overlay} data-boot-loader>
      <PrinterLoader />
    </div>
  );
}
