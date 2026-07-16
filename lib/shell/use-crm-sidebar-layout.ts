"use client";

import { useCallback, useEffect, useReducer } from "react";
import {
  clampCrmSidebarWidth,
  CRM_SIDEBAR_COLLAPSE_DRAG_WIDTH,
  crmSidebarEffectiveWidth,
  defaultCrmSidebarLayout,
  persistCrmSidebarLayout,
  readCrmSidebarLayout,
  type CrmSidebarLayout,
} from "@/lib/shell/crm-sidebar-layout";

type Action =
  | { type: "HYDRATE"; layout: CrmSidebarLayout }
  | { type: "RESIZE"; delta: number }
  | { type: "TOGGLE" };

function reducer(state: CrmSidebarLayout, action: Action): CrmSidebarLayout {
  switch (action.type) {
    case "HYDRATE":
      return action.layout;
    case "RESIZE": {
      const { delta } = action;
      if (!delta) return state;
      if (state.collapsed) {
        if (delta <= 2) return state;
        return {
          ...state,
          collapsed: false,
          width: clampCrmSidebarWidth(state.savedWidth),
        };
      }
      const next = state.width + delta;
      if (next < CRM_SIDEBAR_COLLAPSE_DRAG_WIDTH) {
        return { ...state, collapsed: true, savedWidth: state.width };
      }
      return { ...state, width: clampCrmSidebarWidth(next) };
    }
    case "TOGGLE":
      if (state.collapsed) {
        return {
          ...state,
          collapsed: false,
          width: clampCrmSidebarWidth(state.savedWidth),
        };
      }
      return { ...state, collapsed: true, savedWidth: state.width };
    default:
      return state;
  }
}

export function useCrmSidebarLayout(enabled: boolean) {
  const [layout, dispatch] = useReducer(reducer, defaultCrmSidebarLayout());
  const [hydrated, setHydrated] = useReducer(() => true, false);

  useEffect(() => {
    if (!enabled) return;
    dispatch({ type: "HYDRATE", layout: readCrmSidebarLayout() });
    setHydrated();
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !hydrated) return;
    persistCrmSidebarLayout(layout);
  }, [enabled, hydrated, layout]);

  useEffect(() => {
    if (!enabled) {
      document.documentElement.style.removeProperty("--crm-sidebar-width");
      return;
    }
    document.documentElement.style.setProperty(
      "--crm-sidebar-width",
      `${crmSidebarEffectiveWidth(layout)}px`
    );
    return () => {
      document.documentElement.style.removeProperty("--crm-sidebar-width");
    };
  }, [enabled, layout]);

  const resize = useCallback((delta: number) => {
    dispatch({ type: "RESIZE", delta });
  }, []);

  const toggleCollapsed = useCallback(() => {
    dispatch({ type: "TOGGLE" });
  }, []);

  return {
    width: layout.width,
    collapsed: layout.collapsed,
    effectiveWidth: crmSidebarEffectiveWidth(layout),
    resize,
    toggleCollapsed,
    resizable: enabled,
  };
}
