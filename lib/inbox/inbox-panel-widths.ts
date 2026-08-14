export const INBOX_PANEL_WIDTHS_KEY = "segmiq-inbox-panel-widths";
export const COMPANY_INBOX_PANEL_WIDTHS_KEY = "segmiq-company-inbox-panel-widths";

export const DEFAULT_LIST_PANEL_WIDTH = 360;
export const DEFAULT_INTEL_PANEL_WIDTH = 380;

export const MIN_LIST_PANEL_WIDTH = 280;
export const MAX_LIST_PANEL_WIDTH = 480;
export const MIN_INTEL_PANEL_WIDTH = 320;
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

export function defaultInboxPanelLayout(
  defaults: Partial<Pick<InboxPanelLayout, "list" | "intel">> = {}
): InboxPanelLayout {
  const list = clampListWidth(defaults.list ?? DEFAULT_LIST_PANEL_WIDTH);
  const intel = clampIntelWidth(defaults.intel ?? DEFAULT_INTEL_PANEL_WIDTH);
  return {
    list,
    intel,
    listCollapsed: false,
    intelCollapsed: false,
    listSavedWidth: list,
    intelSavedWidth: intel,
  };
}

export function readInboxPanelLayout({
  storageKey = INBOX_PANEL_WIDTHS_KEY,
  defaults,
}: {
  storageKey?: string;
  defaults?: Partial<Pick<InboxPanelLayout, "list" | "intel">>;
} = {}): InboxPanelLayout {
  if (typeof window === "undefined") {
    return defaultInboxPanelLayout(defaults);
  }
  try {
    const fallback = defaultInboxPanelLayout(defaults);
    const raw = localStorage.getItem(storageKey);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<InboxPanelLayout & InboxPanelWidths>;
    const list = clampListWidth(typeof parsed.list === "number" ? parsed.list : fallback.list);
    const intel = clampIntelWidth(typeof parsed.intel === "number" ? parsed.intel : fallback.intel);
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
    return defaultInboxPanelLayout(defaults);
  }
}

export function persistInboxPanelLayout(
  layout: InboxPanelLayout,
  storageKey = INBOX_PANEL_WIDTHS_KEY
) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(storageKey, JSON.stringify(layout));
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
