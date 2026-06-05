// Client-safe retargeting helpers — no Supabase or server imports.

import {
  RECOVER_TIER_MONTH_MS,
  type ClassifiableLead,
} from "@/lib/lead-lanes";

/** Graduation cutoff — aligned with recoverAgeTier month_plus boundary. */
export const RETARGETING_GRADUATION_AGE_MS = RECOVER_TIER_MONTH_MS;

/**
 * Meta custom audiences need ~100 matched users to deliver; 1000+ is recommended
 * for reliable performance. Default targets the technical minimum.
 */
export const RETARGETING_AUDIENCE_THRESHOLD = 100;

/** Show building progress on the salesperson banner from this fraction of threshold. */
export const RETARGETING_PROGRESS_SHOW_RATIO = 0.5;

export type RetargetingLifecycleStatus =
  | "building"
  | "ready"
  | "ad_pending"
  | "ad_live";

export type RetargetingStatusView = {
  clientId: string;
  clientName: string;
  segmentId: string | null;
  status: RetargetingLifecycleStatus;
  leadCount: number;
  threshold: number;
  hasExport: boolean;
  adLiveAt: string | null;
  lastNudgeAt: string | null;
  bannerDismissedUntil: string | null;
  openTaskId: string | null;
};

/** Pure: uncontacted leads aged past the graduation cutoff. */
export function isRetargetingGraduated(
  lead: ClassifiableLead,
  now: Date = new Date()
): boolean {
  if (lead.status !== "NEW") return false;
  const age = now.getTime() - new Date(lead.created_at).getTime();
  return age >= RETARGETING_GRADUATION_AGE_MS;
}

/** Remove graduated leads from manual call queues without changing lane classification. */
export function excludeGraduatedLeads<T extends ClassifiableLead>(
  leads: T[],
  now: Date = new Date()
): T[] {
  return leads.filter((l) => !isRetargetingGraduated(l, now));
}

/** Pure status derivation from counts and persisted signals. */
export function deriveRetargetingStatus(input: {
  leadCount: number;
  threshold: number;
  hasExport: boolean;
  adLiveAt: string | null;
}): RetargetingLifecycleStatus {
  if (input.adLiveAt) return "ad_live";
  if (input.hasExport) return "ad_pending";
  if (input.leadCount >= input.threshold) return "ready";
  return "building";
}

export function retargetingStatusLabel(status: RetargetingLifecycleStatus): string {
  switch (status) {
    case "building":
      return "Building audience";
    case "ready":
      return "Ready to export";
    case "ad_pending":
      return "Ad pending";
    case "ad_live":
      return "Ad live";
  }
}

export function canNudgeRetargeting(
  lastNudgeAt: string | null,
  now = new Date()
): boolean {
  if (!lastNudgeAt) return true;
  const last = new Date(lastNudgeAt);
  const dayMs = 24 * 60 * 60 * 1000;
  return now.getTime() - last.getTime() >= dayMs;
}
