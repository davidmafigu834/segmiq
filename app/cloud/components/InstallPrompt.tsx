"use client";

import { useEffect, useRef, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isAndroid() {
  return /android/i.test(navigator.userAgent);
}

async function waitForServiceWorker(timeoutMs = 8000): Promise<boolean> {
  if (!("serviceWorker" in navigator)) return false;
  if (navigator.serviceWorker.controller) return true;

  return new Promise((resolve) => {
    const timer = window.setTimeout(() => resolve(false), timeoutMs);
    navigator.serviceWorker.ready
      .then(() => {
        window.clearTimeout(timer);
        resolve(true);
      })
      .catch(() => {
        window.clearTimeout(timer);
        resolve(false);
      });
  });
}

export function InstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [showManualHint, setShowManualHint] = useState(false);
  const gotPrompt = useRef(false);

  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
      return;
    }
    if (localStorage.getItem("pwa-install-dismissed")) {
      setIsDismissed(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      gotPrompt.current = true;
      setInstallEvent(e as BeforeInstallPromptEvent);
      setShowManualHint(false);
    };
    window.addEventListener("beforeinstallprompt", handler);

    let hintTimer: number | undefined;
    void (async () => {
      const swReady = await waitForServiceWorker();
      if (!swReady || gotPrompt.current) return;
      // Android often hides the install prompt — guide users away from "Create shortcut".
      if (isAndroid()) {
        hintTimer = window.setTimeout(() => {
          if (!gotPrompt.current) setShowManualHint(true);
        }, 4000);
      }
    })();

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      if (hintTimer) window.clearTimeout(hintTimer);
    };
  }, []);

  async function handleInstall() {
    if (!installEvent) return;
    await installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    if (outcome === "accepted") setIsInstalled(true);
    setInstallEvent(null);
    setShowManualHint(false);
  }

  function handleDismiss() {
    localStorage.setItem("pwa-install-dismissed", "1");
    setIsDismissed(true);
    setShowManualHint(false);
  }

  if (isInstalled || isDismissed) return null;

  if (installEvent) {
    return (
      <div className="fixed bottom-4 left-4 right-4 z-50 flex items-center gap-3 rounded-2xl border border-[#D4FF4F]/30 bg-[#1a1a1a] p-4 shadow-xl">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#D4FF4F]">
          <span className="text-lg font-bold text-black">C</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white">Install Segmiq Cloud</p>
          <p className="text-xs text-white/50">Opens full-screen like a native app</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={handleDismiss}
            className="px-2 py-1 text-xs text-white/40 hover:text-white/70"
          >
            Not now
          </button>
          <button
            onClick={() => void handleInstall()}
            className="rounded-lg bg-[#D4FF4F] px-3 py-1.5 text-xs font-semibold text-black"
          >
            Install app
          </button>
        </div>
      </div>
    );
  }

  if (!showManualHint) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 rounded-2xl border border-[#D4FF4F]/30 bg-[#1a1a1a] p-4 shadow-xl">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#D4FF4F]">
          <span className="text-lg font-bold text-black">C</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white">Install the app, not a shortcut</p>
          <p className="mt-1 text-xs leading-relaxed text-white/50">
            In Chrome, tap <strong className="text-white">⋮</strong> →{" "}
            <strong className="text-white">Install app</strong> or{" "}
            <strong className="text-white">Add to Home screen</strong>. Avoid{" "}
            <strong className="text-white">Create shortcut</strong> — that only bookmarks the page in the browser.
          </p>
        </div>
        <button
          onClick={handleDismiss}
          className="px-1 text-xl leading-none text-white/40 hover:text-white/70"
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
    </div>
  );
}
