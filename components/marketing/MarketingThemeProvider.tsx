"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  MARKETING_THEME_STORAGE_KEY,
  persistMarketingTheme,
  resolveInitialMarketingTheme,
  type MarketingTheme,
} from "@/lib/marketing/marketing-theme";

type MarketingThemeContextValue = {
  theme: MarketingTheme;
  toggleTheme: () => void;
  setTheme: (theme: MarketingTheme) => void;
};

const MarketingThemeContext = createContext<MarketingThemeContextValue | null>(null);

export function MarketingThemeProvider({
  children,
  initialTheme = "light",
  hasStoredPreference = false,
  pageClassName,
  fallbackTheme = "light",
}: {
  children: ReactNode;
  initialTheme?: MarketingTheme;
  /** True when a cookie already encoded a user/system choice (SSR-aligned). */
  hasStoredPreference?: boolean;
  /** Extra class on the marketing page shell (e.g. landing atmosphere). */
  pageClassName?: string;
  /** Used when no cookie/localStorage preference exists. */
  fallbackTheme?: MarketingTheme;
}) {
  const [theme, setThemeState] = useState<MarketingTheme>(initialTheme);
  const [transitionsReady, setTransitionsReady] = useState(false);

  useEffect(() => {
    if (!hasStoredPreference) {
      let stored: string | null = null;
      try {
        stored = localStorage.getItem(MARKETING_THEME_STORAGE_KEY);
      } catch {
        /* ignore */
      }
      const prefersDark =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches;
      const resolved =
        stored === "dark" || stored === "light"
          ? stored
          : fallbackTheme === "dark"
            ? "dark"
            : resolveInitialMarketingTheme(stored, prefersDark);
      if (resolved !== theme) {
        setThemeState(resolved);
      }
    }

    const frame = requestAnimationFrame(() => setTransitionsReady(true));
    return () => cancelAnimationFrame(frame);
    // Resolve system/localStorage once on mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional mount-only sync
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-marketing-theme", theme);
  }, [theme]);

  useEffect(() => {
    if (!transitionsReady) return;
    persistMarketingTheme(theme);
  }, [theme, transitionsReady]);

  const setTheme = useCallback((next: MarketingTheme) => {
    setThemeState(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((t) => (t === "light" ? "dark" : "light"));
  }, []);

  const value = useMemo(
    () => ({ theme, toggleTheme, setTheme }),
    [theme, toggleTheme, setTheme]
  );

  return (
    <MarketingThemeContext.Provider value={value}>
      <div
        className={`marketing-page min-h-screen text-[var(--marketing-text)] antialiased${
          pageClassName ? ` ${pageClassName}` : ""
        }${theme === "dark" ? " dark" : ""}${transitionsReady ? " marketing-theme-ready" : ""}`}
        data-marketing-theme={theme}
        suppressHydrationWarning
      >
        {children}
      </div>
    </MarketingThemeContext.Provider>
  );
}

export function useMarketingTheme() {
  const ctx = useContext(MarketingThemeContext);
  if (!ctx) {
    throw new Error("useMarketingTheme must be used within MarketingThemeProvider");
  }
  return ctx;
}
