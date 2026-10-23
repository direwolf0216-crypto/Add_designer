import { ViewTransition, type ReactNode } from "react";

/**
 * Route content transition. Runs only during navigations (React transitions) via the browser View
 * Transitions API, so normal re-renders and data updates are never animated or remounted.
 * Put it in each page (layouts persist, so enter/exit would never fire there).
 */
export default function PageReveal({ children }: { children: ReactNode }) {
  // Every page shares one name, so a switch pairs the old page with the new one and crossfades them
  // as one image pair (blended, so the background never shows through mid-way: no flash).
  return (
    <ViewTransition name="app-page" share="page-xfade" enter="page-enter" exit="page-exit" default="none">
      <div className="w-full">{children}</div>
    </ViewTransition>
  );
}

/** Wrap a loading skeleton so it fades out quickly as the real content arrives. */
export function SkeletonExit({ children }: { children: ReactNode }) {
  return (
    <ViewTransition exit="skeleton-exit" default="none">
      <div className="w-full">{children}</div>
    </ViewTransition>
  );
}
