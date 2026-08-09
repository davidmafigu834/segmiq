"use client";

import { useCallback, useEffect, useState } from "react";
import {
  SALES_SIDEBAR_COLLAPSED_KEY,
  SALES_SIDEBAR_WIDTH_COLLAPSED,
  SALES_SIDEBAR_WIDTH_EXPANDED,
} from "@/lib/sales/navigation/sales-nav-config";

export function useSalesSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(SALES_SIDEBAR_COLLAPSED_KEY) === "1");
    } catch {
      setCollapsed(false);
    }
    setHydrated(true);
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SALES_SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const width = collapsed ? SALES_SIDEBAR_WIDTH_COLLAPSED : SALES_SIDEBAR_WIDTH_EXPANDED;

  return { collapsed, toggleCollapsed, width, hydrated };
}
