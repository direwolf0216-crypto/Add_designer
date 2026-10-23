"use client";

// What the browser keeps between visits, and wiping it on sign-out:
// - figures the app fetched (SWR), saved in sessionStorage (this tab only, gone when it closes);
// - the last copy of each page, kept by the service worker for slow or no connection.

export const SAVED_DATA_KEY = "app-data-v1";
export const PAGE_CACHE_PREFIX = "pages-";

/** Forget saved figures and saved pages (sign-out, or a different person signing in). */
export async function clearAppCaches() {
  try {
    sessionStorage.removeItem(SAVED_DATA_KEY);
  } catch {}
  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith(PAGE_CACHE_PREFIX)).map((k) => caches.delete(k)));
    }
  } catch {}
}
