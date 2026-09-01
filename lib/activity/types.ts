/** Phase 16 — unified timeline DTO (references canonical domain records). */

export type ActivityEntityType = "LEAD" | "DEAL" | "CUSTOMER" | "QUOTATION";

export type ActivitySourceType = "LEAD_EVENT" | "CALL_LOG" | "QUOTATION_EVENT";

export type ActivityFilterCategory =
  | "all"
  | "calls"
  | "whatsapp"
  | "notes"
  | "tasks"
  | "documents"
  | "quotes"
  | "system";

export type ActivityActorType = "USER" | "SYSTEM" | "CUSTOMER" | "AGENT";

export type ActivityTimelineItem = {
  id: string;
  sourceType: ActivitySourceType;
  sourceId: string;
  activityType: string;
  title: string;
  summary: string | null;
  occurredAt: string;
  actorType: ActivityActorType;
  actorName: string;
  actorRole: string | null;
  actorUserId: string | null;
  filterCategory: ActivityFilterCategory;
  metadata: Record<string, unknown>;
  pinnedAt: string | null;
  pinnedByUserId: string | null;
  pinnedByName: string | null;
  /** Canonical record reference for deep links */
  refType: "quotation" | "call_log" | null;
  refId: string | null;
};

export type ActivityDateGroup = {
  key: string;
  label: string;
  count: number;
  items: ActivityTimelineItem[];
};

export type LeadTimelineQueryResult = {
  items: ActivityTimelineItem[];
  pinned: ActivityTimelineItem[];
  nextCursor: string | null;
  hasMore: boolean;
  totalApprox: number;
};
