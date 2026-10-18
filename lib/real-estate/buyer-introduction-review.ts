import { searchIsMatchable } from "@/lib/real-estate/buyer-match";
import { isListingLive } from "@/lib/real-estate/listings";

export type IntroductionDecision = "accepted" | "declined";

export function isIntroductionManager(role: string | null | undefined): boolean {
  return role === "CLIENT_MANAGER" || role === "SUPER_ADMIN";
}

/** Who should be told about a new request. The requester is never included. */
export function introductionNotifyUserIds(input: {
  requesterId: string;
  currentAssigneeId: string | null;
  assigneeActive: boolean;
  activeManagerIds: string[];
}): string[] {
  const assigneeCanReview = Boolean(
    input.currentAssigneeId &&
      input.assigneeActive &&
      input.currentAssigneeId !== input.requesterId
  );
  if (assigneeCanReview && input.currentAssigneeId) return [input.currentAssigneeId];
  return [...new Set(input.activeManagerIds.filter((id) => id && id !== input.requesterId))];
}

export function canReviewIntroduction(input: {
  actorId: string;
  actorRole: string | null | undefined;
  requesterId: string | null;
  currentAssigneeId: string | null;
  assigneeActive: boolean;
}): { ok: true } | { ok: false; status: 403; error: string } {
  if (input.requesterId && input.actorId === input.requesterId) {
    return { ok: false, status: 403, error: "You cannot review your own introduction request." };
  }
  if (isIntroductionManager(input.actorRole)) return { ok: true };
  if (
    input.currentAssigneeId &&
    input.currentAssigneeId === input.actorId &&
    input.assigneeActive
  ) {
    return { ok: true };
  }
  return { ok: false, status: 403, error: "You cannot review this introduction." };
}

export function introductionEligibility(input: {
  requesterActive: boolean;
  search: { status: string; pipelineStage: string | null } | null;
  listing: { status: string | null; approvalStatus: string | null } | null;
}): { eligible: true } | { eligible: false; reason: string } {
  if (!input.requesterActive) {
    return { eligible: false, reason: "The requesting agent is no longer active." };
  }
  if (!input.search) {
    return { eligible: false, reason: "The buyer search is no longer available." };
  }
  if (!searchIsMatchable(input.search)) {
    return { eligible: false, reason: "The buyer search is no longer open for matching." };
  }
  if (!input.listing || !isListingLive({ status: input.listing.status, approval_status: input.listing.approvalStatus })) {
    return { eligible: false, reason: "The property is no longer available." };
  }
  return { eligible: true };
}

export function reviewerWaitingCopy(input: { assigneeName: string | null }): string {
  if (input.assigneeName) return `Awaiting review by ${input.assigneeName}.`;
  return "Awaiting review by agency management.";
}
