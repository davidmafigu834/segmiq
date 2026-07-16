"use client";

import { useEffect } from "react";

export function SalesThemeScope({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    document.documentElement.dataset.crmTheme = "light";
    return () => {
      delete document.documentElement.dataset.crmTheme;
    };
  }, []);

  return <div className="crm-theme-light min-h-[100dvh] min-h-[100svh]">{children}</div>;
}
