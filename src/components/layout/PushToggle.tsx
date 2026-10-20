"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { disablePush, enablePush, getPushSubscription, isPushSupported } from "@/lib/client/push";

/** Small control in the notifications panel to turn browser push on/off for this device. */
export default function PushToggle() {
  const [state, setState] = useState<"unsupported" | "loading" | "on" | "off">("loading");

  useEffect(() => {
    let cancelled = false;
    if (!isPushSupported()) {
      Promise.resolve().then(() => !cancelled && setState("unsupported"));
    } else {
      getPushSubscription()
        .then((sub) => !cancelled && setState(sub ? "on" : "off"))
        .catch(() => !cancelled && setState("off"));
    }
    return () => {
      cancelled = true;
    };
  }, []);

  if (state === "unsupported") return null;

  const toggle = async () => {
    const wasOn = state === "on";
    setState("loading");
    try {
      if (wasOn) {
        await disablePush();
        setState("off");
      } else if (await enablePush()) {
        setState("on");
        toast.success("Push notifications enabled on this device");
      } else {
        setState("off");
        toast.error("Notifications are blocked. Allow them in your browser settings.");
      }
    } catch {
      setState(wasOn ? "on" : "off");
      toast.error("Couldn't update push notifications");
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={state === "loading"}
      aria-pressed={state === "on"}
      className="text-[0.7rem] font-bold text-slate-500 hover:text-slate-800 disabled:opacity-50 transition-colors"
    >
      {state === "on" ? "Push: on" : "Enable push"}
    </button>
  );
}
