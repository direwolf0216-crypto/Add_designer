"use client";

import { useEffect } from "react";

/** Registers the app's service worker (push notifications and the app-shell cache) once the page is idle. Built site only. */
export default function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    const register = () => void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(register, { timeout: 5000 });
      return () => window.cancelIdleCallback(id);
    }
    const t = setTimeout(register, 3000);
    return () => clearTimeout(t);
  }, []);
  return null;
}
