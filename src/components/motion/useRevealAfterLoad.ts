"use client";

import { useState } from "react";

/**
 * A class that eases content in when it replaces a loader on screen (it has no view transition of
 * its own), so figures never snap in. Content that is ready straight away gets no animation.
 */
export function useRevealAfterLoad(loading: boolean): string {
  const [waited, setWaited] = useState(loading);
  if (loading && !waited) setWaited(true);
  return waited && !loading ? "animate-tab-in" : "";
}
