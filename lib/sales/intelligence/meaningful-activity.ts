/**
 * Meaningful sales activity — never use leads.updatedAt for staleness.
 */

import {
  FIRST_RESPONSE_EVENT_TYPES,
  MEANINGFUL_LEAD_EVENT_TYPES,
} from "./defaults";

export type ActivityTimestampRow = {
  event_type: string;
  created_at: string;
  channel?: string | null;
};

export function isMeaningfulLeadEvent(eventType: string): boolean {
  return MEANINGFUL_LEAD_EVENT_TYPES.has(eventType);
}

export function isFirstResponseEvent(eventType: string): boolean {
  return FIRST_RESPONSE_EVENT_TYPES.has(eventType);
}

/** Earliest qualifying salesperson contact activity. */
export function deriveFirstRespondedAt(
  events: ActivityTimestampRow[],
  callLogCreatedAts: string[] = [],
  outboundWaAts: string[] = []
): string | null {
  const candidates: string[] = [];
  for (const e of events) {
    if (isFirstResponseEvent(e.event_type) && e.created_at) {
      candidates.push(e.created_at);
    }
  }
  for (const at of callLogCreatedAts) {
    if (at) candidates.push(at);
  }
  for (const at of outboundWaAts) {
    if (at) candidates.push(at);
  }
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.localeCompare(b));
  return candidates[0] ?? null;
}

/** Latest meaningful sales activity across events / calls / WhatsApp. */
export function deriveLastMeaningfulActivityAt(
  events: ActivityTimestampRow[],
  callLogCreatedAts: string[] = [],
  waMessageAts: string[] = []
): string | null {
  const candidates: string[] = [];
  for (const e of events) {
    if (isMeaningfulLeadEvent(e.event_type) && e.created_at) {
      candidates.push(e.created_at);
    }
  }
  for (const at of callLogCreatedAts) {
    if (at) candidates.push(at);
  }
  for (const at of waMessageAts) {
    if (at) candidates.push(at);
  }
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.localeCompare(a));
  return candidates[0] ?? null;
}

export function hoursSince(iso: string | null | undefined, now: Date): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.max(0, (now.getTime() - t) / (1000 * 60 * 60));
}

export function minutesSince(iso: string | null | undefined, now: Date): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.floor((now.getTime() - t) / (1000 * 60)));
}
