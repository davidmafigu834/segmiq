/**
 * Lightweight in-app event bus for Guided Learning.
 * Product UI emits semantic events; the course engine listens.
 * Does not replace analytics — keep payloads free of customer PII.
 */

import type { CourseEventName } from "./types";

export type CourseEventPayload = Record<string, unknown> | undefined;

type Listener = (event: CourseEventName, payload?: CourseEventPayload) => void;

const listeners = new Set<Listener>();

export function emitCourseEvent(event: CourseEventName, payload?: CourseEventPayload): void {
  if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
    // Help debug sticky steps without exposing in production.
    console.debug("[guided-learning]", event, payload ?? {});
  }
  for (const listener of listeners) {
    try {
      listener(event, payload);
    } catch (err) {
      console.warn("[guided-learning] listener error", err);
    }
  }
}

export function subscribeCourseEvents(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Map known sales routes → navigation completion events. */
export function courseEventForPathname(pathname: string): CourseEventName | null {
  if (pathname === "/sales/dashboard" || pathname === "/solo/dashboard") {
    return "NAVIGATED_TO_DASHBOARD";
  }
  if (
    pathname === "/sales/leads" ||
    pathname.startsWith("/sales/leads/") ||
    pathname.startsWith("/sales/deals/")
  ) {
    return "NAVIGATED_TO_PIPELINE";
  }
  if (pathname === "/sales/call-now" || pathname.startsWith("/sales/call-now/")) {
    return "NAVIGATED_TO_LEADS";
  }
  if (pathname === "/sales/tasks" || pathname.startsWith("/sales/tasks/")) {
    return "NAVIGATED_TO_TASKS";
  }
  if (pathname === "/sales/quotes" || pathname.startsWith("/sales/quotes/")) {
    return "NAVIGATED_TO_QUOTES";
  }
  if (pathname === "/sales/inbox" || pathname.startsWith("/sales/inbox/")) {
    return "NAVIGATED_TO_WHATSAPP";
  }
  if (pathname === "/sales/goals" || pathname.startsWith("/sales/goals/")) {
    return "NAVIGATED_TO_GOALS";
  }
  return null;
}
