"use client";

import { useEffect, useState } from "react";

/** Phone — legacy team inbox drawer */
export const INBOX_MOBILE_BP = 860;

/** Tablet + phone — WhatsApp hub single-pane navigation */
export const INBOX_COMPACT_BP = 1180;

function useMediaMaxWidth(maxWidthPx: number): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${maxWidthPx}px)`);
    const update = () => setMatches(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [maxWidthPx]);

  return matches;
}

export function useInboxMobile(): boolean {
  return useMediaMaxWidth(INBOX_MOBILE_BP);
}

/** True at tablet widths and below — drives list → chat → intel pane flow in WhatsApp hub */
export function useInboxCompact(): boolean {
  return useMediaMaxWidth(INBOX_COMPACT_BP);
}
