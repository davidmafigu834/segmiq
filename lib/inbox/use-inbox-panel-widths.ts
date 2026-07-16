"use client";

import { useCallback, useEffect, useReducer } from "react";
import {
  clampIntelWidth,
  clampListWidth,
  defaultInboxPanelLayout,
  INTEL_COLLAPSE_DRAG_WIDTH,
  LIST_COLLAPSE_DRAG_WIDTH,
  persistInboxPanelLayout,
  readInboxPanelLayout,
  type InboxPanelLayout,
} from "@/lib/inbox/inbox-panel-widths";

type Action =
  | { type: "HYDRATE"; layout: InboxPanelLayout }
  | { type: "RESIZE_LIST"; delta: number }
  | { type: "RESIZE_INTEL"; delta: number }
  | { type: "TOGGLE_LIST" }
  | { type: "TOGGLE_INTEL" };

function reducer(state: InboxPanelLayout, action: Action): InboxPanelLayout {
  switch (action.type) {
    case "HYDRATE":
      return action.layout;
    case "RESIZE_LIST": {
      const { delta } = action;
      if (!delta) return state;
      if (state.listCollapsed) {
        if (delta <= 2) return state;
        return {
          ...state,
          listCollapsed: false,
          list: clampListWidth(state.listSavedWidth),
        };
      }
      const next = state.list + delta;
      if (next < LIST_COLLAPSE_DRAG_WIDTH) {
        return { ...state, listCollapsed: true, listSavedWidth: state.list };
      }
      return { ...state, list: clampListWidth(next) };
    }
    case "RESIZE_INTEL": {
      const { delta } = action;
      if (!delta) return state;
      if (state.intelCollapsed) {
        if (delta >= -2) return state;
        return {
          ...state,
          intelCollapsed: false,
          intel: clampIntelWidth(state.intelSavedWidth),
        };
      }
      const next = state.intel - delta;
      if (next < INTEL_COLLAPSE_DRAG_WIDTH) {
        return { ...state, intelCollapsed: true, intelSavedWidth: state.intel };
      }
      return { ...state, intel: clampIntelWidth(next) };
    }
    case "TOGGLE_LIST":
      if (state.listCollapsed) {
        return {
          ...state,
          listCollapsed: false,
          list: clampListWidth(state.listSavedWidth),
        };
      }
      return { ...state, listCollapsed: true, listSavedWidth: state.list };
    case "TOGGLE_INTEL":
      if (state.intelCollapsed) {
        return {
          ...state,
          intelCollapsed: false,
          intel: clampIntelWidth(state.intelSavedWidth),
        };
      }
      return { ...state, intelCollapsed: true, intelSavedWidth: state.intel };
    default:
      return state;
  }
}

export function useInboxPanelWidths(enabled: boolean) {
  const [layout, dispatch] = useReducer(reducer, defaultInboxPanelLayout());
  const [hydrated, setHydrated] = useReducer(() => true, false);

  useEffect(() => {
    if (!enabled) return;
    dispatch({ type: "HYDRATE", layout: readInboxPanelLayout() });
    setHydrated();
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !hydrated) return;
    persistInboxPanelLayout(layout);
  }, [enabled, hydrated, layout]);

  const resizeList = useCallback((delta: number) => {
    dispatch({ type: "RESIZE_LIST", delta });
  }, []);

  const resizeIntel = useCallback((delta: number) => {
    dispatch({ type: "RESIZE_INTEL", delta });
  }, []);

  const toggleListCollapsed = useCallback(() => {
    dispatch({ type: "TOGGLE_LIST" });
  }, []);

  const toggleIntelCollapsed = useCallback(() => {
    dispatch({ type: "TOGGLE_INTEL" });
  }, []);

  return {
    listWidth: layout.list,
    intelWidth: layout.intel,
    listCollapsed: layout.listCollapsed,
    intelCollapsed: layout.intelCollapsed,
    resizeList,
    resizeIntel,
    toggleListCollapsed,
    toggleIntelCollapsed,
    resizable: enabled,
  };
}
