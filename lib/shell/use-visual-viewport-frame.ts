"use client";

import { useEffect } from "react";

const COMPACT_QUERY = "(max-width: 1099.98px)";

/**
 * On phone and tablet widths, size the shell to the visual viewport and shift
 * it when the keyboard opens. Desktop widths keep the CSS 100dvh shell.
 */
export function useVisualViewportFrame(shellRef: { readonly current: HTMLElement | null }) {
  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;
    const mq = window.matchMedia(COMPACT_QUERY);

    const clear = () => {
      shell.style.height = "";
      shell.style.maxHeight = "";
      shell.style.transform = "";
    };

    const apply = () => {
      const viewport = window.visualViewport;
      if (!mq.matches || !viewport) {
        clear();
        return;
      }
      const height = Math.max(0, Math.round(viewport.height));
      const offset = Math.max(0, Math.round(viewport.offsetTop));
      const keyboardOpen = offset > 0 || height < window.innerHeight - 80;
      if (!keyboardOpen) {
        clear();
        return;
      }
      shell.style.height = `${height}px`;
      shell.style.maxHeight = `${height}px`;
      shell.style.transform = offset > 0 ? `translateY(${offset}px)` : "translateY(0)";
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
      clear();
    };
  }, [shellRef]);
}
