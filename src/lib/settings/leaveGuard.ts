"use client";

import { useCallback, useEffect } from "react";
import { useConfirm } from "@/components/ui/confirm-dialog";

// One settings tab at a time can hold unsaved edits. The tab registers a check here; the settings
// sidebar asks before switching tabs or leaving, and the browser asks before closing the page.
let unsavedCheck: (() => boolean) | null = null;

/** Registers the open tab's unsaved state while it is mounted, and warns before the page is closed. */
export function useSettingsUnsaved(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const check = () => true;
    unsavedCheck = check;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      if (unsavedCheck === check) unsavedCheck = null;
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [dirty]);
}

/** Resolves true when it is fine to leave the open tab: nothing unsaved, or the user chose to discard. */
export function useConfirmSettingsLeave() {
  const confirm = useConfirm();
  return useCallback(async () => {
    if (!unsavedCheck?.()) return true;
    const ok = await confirm({
      title: "Discard unsaved changes?",
      description: "You have changes on this tab that aren't saved yet.",
      confirmLabel: "Discard changes",
      cancelLabel: "Keep editing",
      tone: "danger",
      icon: "ph-warning",
    });
    if (ok) unsavedCheck = null;
    return ok;
  }, [confirm]);
}
