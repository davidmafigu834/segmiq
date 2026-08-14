"use client";

import { useCallback, useEffect, useState } from "react";
import {
  COMPANY_SIDEBAR_COLLAPSED_KEY,
  COMPANY_SIDEBAR_WIDTH_COLLAPSED,
  COMPANY_SIDEBAR_WIDTH_EXPANDED,
} from "@/lib/sales/navigation/company-nav-config";

export function useCompanySidebarCollapsed({
  preferCollapsedOnFirstVisit = false,
}: {
  preferCollapsedOnFirstVisit?: boolean;
} = {}) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(COMPANY_SIDEBAR_COLLAPSED_KEY);
      if (stored == null && preferCollapsedOnFirstVisit) {
        localStorage.setItem(COMPANY_SIDEBAR_COLLAPSED_KEY, "1");
        setCollapsed(true);
        return;
      }
      setCollapsed(stored === "1");
    } catch {
      setCollapsed(preferCollapsedOnFirstVisit);
    }
  }, [preferCollapsedOnFirstVisit]);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(COMPANY_SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const width = collapsed ? COMPANY_SIDEBAR_WIDTH_COLLAPSED : COMPANY_SIDEBAR_WIDTH_EXPANDED;

  return { collapsed, toggleCollapsed, width };
}
