"use client";

import { useCallback, useSyncExternalStore } from "react";

// Same-tab writes don't fire the `storage` event, so setters notify subscribers directly.
const listeners = new Set<() => void>();
// Used only when localStorage is unavailable (e.g. blocked site data) so toggles still work in-memory.
const memory = new Map<string, boolean>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** A boolean persisted in localStorage under `key` ("true"/"false"); `false` on the server and first hydration pass. */
export function useStoredBoolean(key: string): [boolean, (next: boolean) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => {
      try {
        return localStorage.getItem(key) === "true";
      } catch {
        return memory.get(key) ?? false;
      }
    },
    () => false
  );

  const setValue = useCallback(
    (next: boolean) => {
      try {
        localStorage.setItem(key, String(next));
      } catch {
        memory.set(key, next);
      }
      listeners.forEach((l) => l());
    },
    [key]
  );

  return [value, setValue];
}
