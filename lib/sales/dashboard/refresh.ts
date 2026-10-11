export const SALES_WORK_CHANGED_EVENT = "segmiq:sales-work-changed";

/** Ask open Tasks and chat views to reload the same work items. */
export function notifySalesWorkChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(SALES_WORK_CHANGED_EVENT));
}
