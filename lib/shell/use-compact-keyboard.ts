"use client";

import { useEffect, useState } from "react";

const COMPACT_QUERY = "(max-width: 1099.98px)";

/**
 * Same compact-width keyboard signal as useVisualViewportFrame.
 * Desktop widths stay false so the intelligence panel is not collapsed.
 */
export function useCompactKeyboardOpen() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(COMPACT_QUERY);

    const apply = () => {
      const viewport = window.visualViewport;
      if (!mq.matches || !viewport) {
        setOpen(false);
        return;
      }
      const height = Math.round(viewport.height);
      const offset = Math.max(0, Math.round(viewport.offsetTop));
      setOpen(offset > 0 || height < window.innerHeight - 80);
    };

    apply();
    mq.addEventListener("change", apply);
    window.visualViewport?.addEventListener("resize", apply);
    window.visualViewport?.addEventListener("scroll", apply);
    window.addEventListener("orientationchange", apply);

    return () => {
      mq.removeEventListener("change", apply);
      window.visualViewport?.removeEventListener("resize", apply);
      window.visualViewport?.removeEventListener("scroll", apply);
      window.removeEventListener("orientationchange", apply);
    };
  }, []);

  return open;
}
