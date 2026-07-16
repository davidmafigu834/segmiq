export const CRM_SIDEBAR_LAYOUT_KEY = "segmiq-crm-sidebar-layout";

export const DEFAULT_CRM_SIDEBAR_WIDTH = 240;
export const MIN_CRM_SIDEBAR_WIDTH = 200;
export const MAX_CRM_SIDEBAR_WIDTH = 320;
export const CRM_SIDEBAR_COLLAPSED_WIDTH = 56;
export const CRM_SIDEBAR_COLLAPSE_DRAG_WIDTH = 180;

export type CrmSidebarLayout = {
  width: number;
  collapsed: boolean;
  savedWidth: number;
};

export function clampCrmSidebarWidth(value: number): number {
  return Math.round(Math.min(MAX_CRM_SIDEBAR_WIDTH, Math.max(MIN_CRM_SIDEBAR_WIDTH, value)));
}

export function defaultCrmSidebarLayout(): CrmSidebarLayout {
  return {
    width: DEFAULT_CRM_SIDEBAR_WIDTH,
    collapsed: false,
    savedWidth: DEFAULT_CRM_SIDEBAR_WIDTH,
  };
}

export function readCrmSidebarLayout(): CrmSidebarLayout {
  if (typeof window === "undefined") {
    return defaultCrmSidebarLayout();
  }
  try {
    const raw = localStorage.getItem(CRM_SIDEBAR_LAYOUT_KEY);
    if (!raw) return defaultCrmSidebarLayout();
    const parsed = JSON.parse(raw) as Partial<CrmSidebarLayout>;
    const width = clampCrmSidebarWidth(
      typeof parsed.width === "number" ? parsed.width : DEFAULT_CRM_SIDEBAR_WIDTH
    );
    return {
      width,
      collapsed: parsed.collapsed === true,
      savedWidth: clampCrmSidebarWidth(
        typeof parsed.savedWidth === "number" ? parsed.savedWidth : width
      ),
    };
  } catch {
    return defaultCrmSidebarLayout();
  }
}

export function persistCrmSidebarLayout(layout: CrmSidebarLayout) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CRM_SIDEBAR_LAYOUT_KEY, JSON.stringify(layout));
  } catch {
    /* ignore */
  }
}

export function crmSidebarEffectiveWidth(layout: CrmSidebarLayout): number {
  return layout.collapsed ? CRM_SIDEBAR_COLLAPSED_WIDTH : layout.width;
}
