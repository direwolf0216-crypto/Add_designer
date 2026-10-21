"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

type ConfirmOptions = {
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "default";
  icon?: string;
};

const ConfirmContext = createContext<((options: ConfirmOptions) => Promise<boolean>) | null>(null);

/** Replaces window.confirm(): `const confirm = useConfirm(); if (await confirm({ title })) …` */
export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within ConfirmDialogProvider");
  return ctx;
}

export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((next: ConfirmOptions) => {
    setOptions(next);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const settle = (value: boolean) => {
    resolver.current?.(value);
    resolver.current = null;
    setOptions(null);
  };

  const danger = options?.tone === "danger";
  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog open={!!options} onOpenChange={(open) => !open && settle(false)}>
        <DialogContent showCloseButton={false} className="sm:max-w-md !rounded-3xl !p-0 overflow-hidden">
          <div className="flex gap-4 p-6">
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${danger ? "bg-rose-50 text-rose-600" : "bg-slate-100 text-slate-700"}`}>
              <i className={`ph-bold ${options?.icon ?? (danger ? "ph-trash" : "ph-question")} text-xl`} aria-hidden="true"></i>
            </span>
            <div className="min-w-0">
              <DialogTitle className="text-base font-extrabold text-slate-900">{options?.title}</DialogTitle>
              {options?.description && <DialogDescription className="mt-1 text-sm text-slate-500">{options.description}</DialogDescription>}
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50/70 px-6 py-4">
            <button type="button" onClick={() => settle(false)} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">
              {options?.cancelLabel ?? "Cancel"}
            </button>
            <button
              type="button"
              autoFocus
              onClick={() => settle(true)}
              className={`rounded-xl px-4 py-2 text-sm font-bold text-white shadow-sm ${danger ? "bg-rose-600 hover:bg-rose-700" : "bg-slate-900 hover:bg-slate-800"}`}
            >
              {options?.confirmLabel ?? "Confirm"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </ConfirmContext.Provider>
  );
}
