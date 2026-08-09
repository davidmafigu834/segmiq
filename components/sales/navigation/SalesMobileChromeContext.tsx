"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type SalesMobileChromeContextValue = {
  moreOpen: boolean;
  setMoreOpen: (open: boolean) => void;
  quickActionsOpen: boolean;
  setQuickActionsOpen: (open: boolean) => void;
  hideBottomNav: boolean;
  setHideBottomNav: (hide: boolean) => void;
};

const SalesMobileChromeContext = createContext<SalesMobileChromeContextValue | null>(null);

export function SalesMobileChromeProvider({ children }: { children: ReactNode }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  const [hideBottomNav, setHideBottomNav] = useState(false);

  const value = useMemo(
    () => ({
      moreOpen,
      setMoreOpen,
      quickActionsOpen,
      setQuickActionsOpen,
      hideBottomNav,
      setHideBottomNav,
    }),
    [moreOpen, quickActionsOpen, hideBottomNav]
  );

  return (
    <SalesMobileChromeContext.Provider value={value}>{children}</SalesMobileChromeContext.Provider>
  );
}

export function useSalesMobileChrome() {
  const ctx = useContext(SalesMobileChromeContext);
  if (!ctx) {
    return {
      moreOpen: false,
      setMoreOpen: (_: boolean) => {},
      quickActionsOpen: false,
      setQuickActionsOpen: (_: boolean) => {},
      hideBottomNav: false,
      setHideBottomNav: (_: boolean) => {},
    };
  }
  return ctx;
}

/** Sync WhatsApp chat/intel panes to hide bottom nav. */
export function useHideSalesBottomNav(hide: boolean) {
  const { setHideBottomNav } = useSalesMobileChrome();
  const set = useCallback(
    (v: boolean) => {
      setHideBottomNav(v);
    },
    [setHideBottomNav]
  );

  // callers useEffect themselves; expose setter for clarity
  return set;
}
