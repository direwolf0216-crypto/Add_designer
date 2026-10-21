"use client";

import { Toaster } from "sonner";

/** In-app notifications: glass card, icon chip per tone, no browser/OS notifications. */
export default function AppToaster() {
  const chip = (tone: string, icon: string) => (
    <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${tone}`}>
      <i className={`ph-bold ${icon} text-[15px]`} aria-hidden="true"></i>
    </span>
  );
  return (
    <Toaster
      position="top-right"
      closeButton
      gap={10}
      icons={{
        success: chip("bg-emerald-50 text-emerald-600", "ph-check-circle"),
        error: chip("bg-rose-50 text-rose-600", "ph-warning-circle"),
        warning: chip("bg-amber-50 text-amber-600", "ph-warning"),
        info: chip("bg-sky-50 text-sky-600", "ph-info"),
        loading: chip("bg-slate-100 text-slate-500", "ph-circle-notch animate-spin"),
      }}
      toastOptions={{
        unstyled: false,
        classNames: {
          toast:
            "!rounded-2xl !border !border-slate-200/80 !bg-white/90 !backdrop-blur-xl !shadow-[0_18px_40px_-12px_rgba(15,23,42,0.25)] !px-4 !py-3 !gap-3 !font-sans",
          title: "!text-[13px] !font-bold !text-slate-900",
          description: "!text-xs !text-slate-500",
          closeButton: "!bg-white !border-slate-200 !text-slate-400 hover:!text-slate-700",
          actionButton: "!bg-slate-900 !text-white !rounded-lg !font-bold",
        },
      }}
    />
  );
}
