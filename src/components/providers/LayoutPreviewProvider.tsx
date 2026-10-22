"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { FormLayout } from "@/lib/forms/types";

interface LayoutPreviewValue {
  /** Draft layouts by formKey that replace the saved ones inside this subtree. */
  layouts: Record<string, FormLayout>;
  /** True inside the layout builder's preview: forms render but never save. */
  preview: boolean;
}

const LayoutPreviewContext = createContext<LayoutPreviewValue>({ layouts: {}, preview: false });

/** Wraps a form so it renders from an unsaved layout draft (Settings → Layouts & Fields → Preview). */
export function LayoutPreviewProvider({ layouts, children }: { layouts: Record<string, FormLayout>; children: ReactNode }) {
  return <LayoutPreviewContext.Provider value={{ layouts, preview: true }}>{children}</LayoutPreviewContext.Provider>;
}

export function useLayoutPreview(): LayoutPreviewValue {
  return useContext(LayoutPreviewContext);
}
