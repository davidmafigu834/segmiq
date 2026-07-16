"use client";

import { usePathname } from "next/navigation";
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
  isCrmPath,
  persistCrmTheme,
  readStoredCrmTheme,
  type CrmTheme,
} from "@/lib/crm-theme";

type CrmThemeContextValue = {
  theme: CrmTheme;
  setTheme: (theme: CrmTheme) => void;
};

const CrmThemeContext = createContext<CrmThemeContextValue | null>(null);

function applyCrmThemeToDocument(theme: CrmTheme, isCrm: boolean) {
  const html = document.documentElement;
  if (!isCrm) {
    delete html.dataset.crm;
    delete html.dataset.crmTheme;
    return;
  }
  html.dataset.crm = "";
  if (theme === "light") {
    html.dataset.crmTheme = "light";
  } else {
    delete html.dataset.crmTheme;
  }
}

export function CrmThemeProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isCrm = isCrmPath(pathname);
  const [theme, setThemeState] = useState<CrmTheme>("dark");

  useEffect(() => {
    setThemeState(readStoredCrmTheme());
  }, []);

  useEffect(() => {
    applyCrmThemeToDocument(theme, isCrm);
  }, [theme, isCrm, pathname]);

  const setTheme = useCallback((next: CrmTheme) => {
    setThemeState(next);
    persistCrmTheme(next);
  }, []);

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);

  if (!isCrm) {
    return <>{children}</>;
  }

  return (
    <CrmThemeContext.Provider value={value}>
      <div
        className={
          theme === "light" ? "crm-theme-light min-h-[100dvh] min-h-[100svh]" : undefined
        }
      >
        {children}
      </div>
    </CrmThemeContext.Provider>
  );
}

export function useCrmTheme() {
  const ctx = useContext(CrmThemeContext);
  if (!ctx) {
    throw new Error("useCrmTheme must be used within CrmThemeProvider on a CRM route");
  }
  return ctx;
}

export function useCrmThemeOptional() {
  return useContext(CrmThemeContext);
}
