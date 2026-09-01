"use client";

import { useEffect, useRef } from "react";

const HEARTBEAT_MS = 60_000;

/** Lightweight authenticated presence heartbeat — pauses when tab is hidden. */
export function usePresenceHeartbeat(enabled = true) {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!enabled) return;

    async function ping(availabilityOverride?: "AVAILABLE" | "AWAY" | "BUSY" | null) {
      try {
        await fetch("/api/users/me/presence", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            availabilityOverride !== undefined ? { availabilityOverride } : {}
          ),
        });
      } catch {
        // non-blocking
      }
    }

    function start() {
      if (timerRef.current) return;
      void ping();
      timerRef.current = setInterval(() => {
        if (document.visibilityState === "visible") void ping();
      }, HEARTBEAT_MS);
    }

    function stop() {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    function onVisibility() {
      if (document.visibilityState === "visible") {
        void ping();
        start();
      } else {
        stop();
      }
    }

    start();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled]);
}

export async function setAvailabilityOverride(
  availabilityOverride: "AVAILABLE" | "AWAY" | "BUSY" | null
) {
  const res = await fetch("/api/users/me/presence", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ availabilityOverride }),
  });
  if (!res.ok) throw new Error("Could not update availability");
}
