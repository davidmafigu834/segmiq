"use client";

import { useEffect } from "react";

/**
 * One-time, app-wide kill switch for a previously-shipped service worker that
 * cached /_next/static app code cache-first. That worker (scope "/") kept
 * serving stale JS on every route — including non-cloud pages like /sales —
 * causing "old UI" and hydration mismatches that survive a normal reload.
 *
 * This runs once per browser: it unregisters any active service worker, deletes
 * its caches, then reloads so fresh assets come straight from the network. The
 * cloud PWA re-registers the (now fixed) worker when you next visit /cloud.
 *
 * Bump CLEANUP_KEY if a future bad worker ever needs the same flush again.
 */
const CLEANUP_KEY = "sw-cleanup-v2";

function isCloudContext(): boolean {
  const host = window.location.hostname;
  if (host === "cloud.localhost" || host.startsWith("cloud.")) return true;
  return window.location.pathname.startsWith("/cloud");
}

export function ServiceWorkerCleanup() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    // Cloud PWA manages its own worker — never unregister it from the main app shell.
    if (isCloudContext()) return;
    try {
      if (localStorage.getItem(CLEANUP_KEY)) return;
    } catch {
      return;
    }

    (async () => {
      let removedSomething = false;
      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        if (regs.length > 0) {
          await Promise.all(regs.map((r) => r.unregister()));
          removedSomething = true;
        }
        if ("caches" in window) {
          const keys = await caches.keys();
          const stale = keys.filter((k) => k.startsWith("leadstaq-cloud-"));
          if (stale.length > 0) {
            await Promise.all(stale.map((k) => caches.delete(k)));
            removedSomething = true;
          }
        }
      } catch {
        /* best-effort */
      } finally {
        // Set the flag before any reload so we never loop.
        try {
          localStorage.setItem(CLEANUP_KEY, "1");
        } catch {
          /* ignore */
        }
        if (removedSomething) window.location.reload();
      }
    })();
  }, []);

  return null;
}
