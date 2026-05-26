"use client";

import { useEffect, useState } from "react";

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isInStandaloneMode() {
  return window.matchMedia("(display-mode: standalone)").matches;
}

export function IOSInstallBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isIOS() && !isInStandaloneMode() && !localStorage.getItem("ios-install-dismissed")) {
      setShow(true);
    }
  }, []);

  if (!show) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-[#1a1a1a] p-4 pb-safe">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#D4FF4F]">
          <span className="text-lg font-bold text-black">C</span>
        </div>
        <div className="flex-1">
          <p className="mb-0.5 text-sm font-semibold text-white">Install Segmiq Cloud</p>
          <p className="text-xs leading-relaxed text-white/50">
            Tap the <strong className="text-white">Share</strong> button ⬆ then{" "}
            <strong className="text-white">&quot;Add to Home Screen&quot;</strong> for quick access from your phone.
          </p>
        </div>
        <button
          onClick={() => {
            localStorage.setItem("ios-install-dismissed", "1");
            setShow(false);
          }}
          className="mt-0.5 px-1 text-xl leading-none text-white/40 hover:text-white/70"
        >
          ×
        </button>
      </div>
    </div>
  );
}
