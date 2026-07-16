export const INBOX_PANEL_WIDTHS_KEY = "segmiq-inbox-panel-widths";

export const DEFAULT_LIST_PANEL_WIDTH = 360;
export const DEFAULT_INTEL_PANEL_WIDTH = 360;

export const MIN_LIST_PANEL_WIDTH = 280;
export const MAX_LIST_PANEL_WIDTH = 480;
export const MIN_INTEL_PANEL_WIDTH = 300;
export const MAX_INTEL_PANEL_WIDTH = 520;

/** Drag below this width to snap the conversations panel closed. */
export const LIST_COLLAPSE_DRAG_WIDTH = 260;
/** Drag below this width to snap the lead workspace panel closed. */
export const INTEL_COLLAPSE_DRAG_WIDTH = 280;

export type InboxPanelLayout = {
  list: number;
  intel: number;
  listCollapsed: boolean;
  intelCollapsed: boolean;
  listSavedWidth: number;
  intelSavedWidth: number;
};

/** @deprecated Legacy shape — still read for migration. */
export type InboxPanelWidths = {
  list: number;
  intel: number;
};

export function clampListWidth(value: number): number {
  return Math.round(Math.min(MAX_LIST_PANEL_WIDTH, Math.max(MIN_LIST_PANEL_WIDTH, value)));
}

export function clampIntelWidth(value: number): number {
  return Math.round(Math.min(MAX_INTEL_PANEL_WIDTH, Math.max(MIN_INTEL_PANEL_WIDTH, value)));
}

export function defaultInboxPanelLayout(): InboxPanelLayout {
  return {
    list: DEFAULT_LIST_PANEL_WIDTH,
    intel: DEFAULT_INTEL_PANEL_WIDTH,
    listCollapsed: false,
    intelCollapsed: false,
    listSavedWidth: DEFAULT_LIST_PANEL_WIDTH,
    intelSavedWidth: DEFAULT_INTEL_PANEL_WIDTH,
  };
}

export function readInboxPanelLayout(): InboxPanelLayout {
  if (typeof window === "undefined") {
    return defaultInboxPanelLayout();
  }
  try {
    const raw = localStorage.getItem(INBOX_PANEL_WIDTHS_KEY);
    if (!raw) return defaultInboxPanelLayout();
    const parsed = JSON.parse(raw) as Partial<InboxPanelLayout & InboxPanelWidths>;
    const list = clampListWidth(typeof parsed.list === "number" ? parsed.list : DEFAULT_LIST_PANEL_WIDTH);
    const intel = clampIntelWidth(typeof parsed.intel === "number" ? parsed.intel : DEFAULT_INTEL_PANEL_WIDTH);
    return {
      list,
      intel,
      listCollapsed: parsed.listCollapsed === true,
      intelCollapsed: parsed.intelCollapsed === true,
      listSavedWidth: clampListWidth(
        typeof parsed.listSavedWidth === "number" ? parsed.listSavedWidth : list
      ),
      intelSavedWidth: clampIntelWidth(
        typeof parsed.intelSavedWidth === "number" ? parsed.intelSavedWidth : intel
      ),
    };
  } catch {
    return defaultInboxPanelLayout();
  }
}

export function persistInboxPanelLayout(layout: InboxPanelLayout) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(INBOX_PANEL_WIDTHS_KEY, JSON.stringify(layout));
  } catch {
    /* ignore */
  }
}

/** @deprecated Use readInboxPanelLayout */
export function readInboxPanelWidths(): InboxPanelWidths {
  const layout = readInboxPanelLayout();
  return { list: layout.list, intel: layout.intel };
}

/** @deprecated Use persistInboxPanelLayout */
export function persistInboxPanelWidths(widths: InboxPanelWidths) {
  const current = readInboxPanelLayout();
  persistInboxPanelLayout({ ...current, list: widths.list, intel: widths.intel });
}
