"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

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
      setInstallEvent(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function handleInstall() {
    if (!installEvent) return;
    await installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    if (outcome === "accepted") setIsInstalled(true);
    setInstallEvent(null);
  }

  function handleDismiss() {
    localStorage.setItem("pwa-install-dismissed", "1");
    setIsDismissed(true);
  }

  if (isInstalled || isDismissed || !installEvent) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 flex items-center gap-3 rounded-2xl border border-[#D4FF4F]/30 bg-[#1a1a1a] p-4 shadow-xl">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#D4FF4F]">
        <span className="text-lg font-bold text-black">C</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-white">Install Segmiq Cloud</p>
        <p className="text-xs text-white/50">Add to home screen for quick access</p>
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
          Install
        </button>
      </div>
    </div>
  );
}
