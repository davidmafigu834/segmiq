/**
 * Real-estate sales pipeline — presentation layer over shared leads.
 * Trades continue using LeadStatus / DealStage enums unchanged.
 */

import type { LeadStatus, OfferStatus } from "@/types";

export const RE_ACTIVE_STAGES = [
  "new_inquiry",
  "contacted",
  "qualified",
  "property_matched",
  "viewing_scheduled",
  "viewing_completed",
  "interested",
  "offer_submitted",
  "negotiating",
  "offer_accepted",
] as const;

export const RE_CLOSED_STAGES = ["won", "lost", "not_qualified"] as const;

export type ReActiveStage = (typeof RE_ACTIVE_STAGES)[number];
export type ReClosedStage = (typeof RE_CLOSED_STAGES)[number];
export type RePipelineStage = ReActiveStage | ReClosedStage;

export const RE_PIPELINE_STAGE_LABEL: Record<RePipelineStage, string> = {
  new_inquiry: "New Inquiry",
  contacted: "Contacted",
  qualified: "Qualified",
  property_matched: "Property Matched",
  viewing_scheduled: "Viewing Scheduled",
  viewing_completed: "Viewing Completed",
  interested: "Interested",
  offer_submitted: "Offer Submitted",
  negotiating: "Negotiating",
  offer_accepted: "Offer Accepted",
  won: "Won",
  lost: "Lost",
  not_qualified: "Not Qualified",
};

export const RE_STAGE_GUIDANCE: Record<RePipelineStage, string> = {
  new_inquiry: "Contact the client and understand what they are looking for.",
  contacted: "Capture or confirm property requirements and qualify intent.",
  qualified: "Find suitable properties that match their requirements.",
  property_matched: "Schedule a viewing on a matched property.",
  viewing_scheduled: "Confirm the appointment and prepare the client.",
  viewing_completed: "Record client interest and follow up.",
  interested: "Agree next steps — similar properties, or prepare an offer.",
  offer_submitted: "Track the seller response and keep the buyer informed.",
  negotiating: "Work terms until both sides agree or the offer closes.",
  offer_accepted: "Start client due diligence, then wait for compliance approval before the sale can complete.",
  won: "This opportunity is closed won.",
  lost: "This opportunity is closed lost.",
  not_qualified: "This inquiry is not a fit to progress.",
};

export type RePipelineFacts = {
  leadStatus: string | null | undefined;
  offerStatus?: string | null;
  hasInterestedListing?: boolean;
  hasLinkedListing?: boolean;
  hasUpcomingViewing?: boolean;
  hasCompletedViewing?: boolean;
  /** Explicit agent mark — never inferred from a completed viewing alone. */
  markedInterested?: boolean;
};

const CLOSED_LEAD = new Set(["WON", "LOST", "NOT_QUALIFIED"]);

export function resolveRePipelineStage(facts: RePipelineFacts): RePipelineStage {
  const status = String(facts.leadStatus ?? "NEW").toUpperCase();
  if (status === "NOT_QUALIFIED") return "not_qualified";
  if (status === "LOST") return "lost";
  if (status === "WON") return "won";

  const offer = String(facts.offerStatus ?? "").toLowerCase();
  if (offer === "accepted") return "offer_accepted";
  if (offer === "countered") return "negotiating";
  if (offer === "submitted") return "offer_submitted";

  if (facts.markedInterested) return "interested";
  if (facts.hasCompletedViewing) return "viewing_completed";
  if (facts.hasUpcomingViewing) return "viewing_scheduled";
  if (facts.hasInterestedListing || facts.hasLinkedListing) return "property_matched";

  if (status === "QUALIFIED" || status === "CONVERTED_TO_DEAL") return "qualified";
  if (status === "CONTACTED") return "contacted";
  return "new_inquiry";
}

export function rePipelineStageLabel(stage: RePipelineStage | string | null | undefined): string {
  if (!stage) return RE_PIPELINE_STAGE_LABEL.new_inquiry;
  if (stage in RE_PIPELINE_STAGE_LABEL) return RE_PIPELINE_STAGE_LABEL[stage as RePipelineStage];
  return String(stage).replace(/_/g, " ");
}

export function isReClosedStage(stage: RePipelineStage): boolean {
  return (RE_CLOSED_STAGES as readonly string[]).includes(stage);
}

/** Stages the agent can set directly without a matching/viewing/offer fact. */
export const RE_MANUAL_STAGES = [
  "new_inquiry",
  "contacted",
  "qualified",
  "interested",
  "lost",
  "not_qualified",
] as const satisfies readonly RePipelineStage[];

export type ReManualStage = (typeof RE_MANUAL_STAGES)[number];

export function isReManualStage(stage: string): stage is ReManualStage {
  return (RE_MANUAL_STAGES as readonly string[]).includes(stage);
}

/** Map a manual RE stage onto the shared leads.status enum. */
export function leadStatusForReStage(stage: ReManualStage): LeadStatus {
  if (stage === "new_inquiry") return "NEW";
  if (stage === "contacted") return "CONTACTED";
  if (stage === "qualified" || stage === "interested") return "QUALIFIED";
  if (stage === "lost") return "LOST";
  return "NOT_QUALIFIED";
}

export function markedInterestedFromFormData(
  formData: Record<string, unknown> | null | undefined
): boolean {
  return formData?.re_interested === true;
}

export function withMarkedInterested(
  formData: Record<string, unknown> | null | undefined,
  interested: boolean
): Record<string, unknown> {
  const next = { ...(formData ?? {}) };
  if (interested) next.re_interested = true;
  else delete next.re_interested;
  return next;
}

export function primaryActionForStage(stage: RePipelineStage): {
  id: "contact" | "requirements" | "find_property" | "schedule_viewing" | "complete_viewing" | "follow_up" | "offer" | "none";
  label: string;
} {
  switch (stage) {
    case "new_inquiry":
      return { id: "contact", label: "Contact client" };
    case "contacted":
      return { id: "requirements", label: "Update requirements" };
    case "qualified":
      return { id: "find_property", label: "Find property" };
    case "property_matched":
      return { id: "schedule_viewing", label: "Schedule viewing" };
    case "viewing_scheduled":
      return { id: "complete_viewing", label: "Complete viewing" };
    case "viewing_completed":
      return { id: "follow_up", label: "Record follow-up" };
    case "interested":
      return { id: "offer", label: "Create offer" };
    case "offer_submitted":
    case "negotiating":
    case "offer_accepted":
      return { id: "offer", label: "Open offer" };
    default:
      return { id: "none", label: "Open inquiry" };
  }
}

export function suggestedStageAfterViewing(sentiment: string | null | undefined): RePipelineStage | null {
  if (sentiment === "positive") return "interested";
  return null;
}

export function isOfferStatus(value: string | null | undefined): value is OfferStatus {
  return value === "submitted" || value === "countered" || value === "accepted" || value === "rejected";
}
