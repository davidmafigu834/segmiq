/**
 * Viewing visibility. Managers see every viewing in their organisation.
 * An agent has full access to viewings they run or that belong to a search they own.
 * The listing agent and listing collaborators see viewings on that listing with
 * the buyer's contact details masked. Everyone else sees nothing.
 */

export type ViewingAccess = "full" | "listing_only" | "none";

export function viewingAccess(input: {
  actorId: string;
  role: string | null | undefined;
  viewingAgentId: string | null;
  searchAgentId: string | null;
  listingAgentId: string | null;
  isListingCollaborator: boolean;
}): ViewingAccess {
  if (input.role === "SUPER_ADMIN" || input.role === "CLIENT_MANAGER") return "full";
  if (input.viewingAgentId && input.viewingAgentId === input.actorId) return "full";
  if (input.searchAgentId && input.searchAgentId === input.actorId) return "full";
  if (input.listingAgentId && input.listingAgentId === input.actorId) return "listing_only";
  if (input.isListingCollaborator) return "listing_only";
  return "none";
}

export type ViewingChange = "status" | "reschedule" | "feedback" | "reassign" | "confirm" | "follow_up";

export function canChangeViewing(access: ViewingAccess, change: ViewingChange, role: string | null | undefined): boolean {
  if (access === "none") return false;
  if (change === "reassign") return role === "SUPER_ADMIN" || role === "CLIENT_MANAGER";
  if (access === "listing_only") return change === "feedback";
  return true;
}

const TERMINAL = new Set(["completed", "no_show"]);

/** Status changes refused regardless of permission. A cancelled viewing may be rescheduled. */
export function viewingTransitionError(from: string, to: string): string | null {
  if (from === to) return null;
  if (TERMINAL.has(from)) return "This viewing is already closed. Book a new viewing instead.";
  if (from === "cancelled" && to !== "scheduled") return "A cancelled viewing can only be rescheduled.";
  return null;
}

/** Masks buyer details for listing-only access: first name and initial, no phone. */
export function maskViewingContact<T extends { contact?: { id?: string; name?: string | null; phone?: string | null } | null }>(
  row: T,
  access: ViewingAccess
): T {
  if (access !== "listing_only" || !row.contact) return row;
  const parts = (row.contact.name ?? "").trim().split(/\s+/).filter(Boolean);
  const masked = parts.length ? `${parts[0]}${parts[1] ? ` ${parts[1][0]}.` : ""}` : "Buyer";
  return { ...row, contact: { id: row.contact.id, name: masked, phone: null } };
}

/** A reminder is due once per scheduled time. Rescheduling makes a new reminder due. */
export function viewingReminderDue(input: {
  status: string;
  scheduledAt: string;
  reminderSentFor: string | null;
  now: Date;
  leadMinutes: number;
}): boolean {
  if (input.status !== "scheduled") return false;
  const start = new Date(input.scheduledAt).getTime();
  if (!Number.isFinite(start)) return false;
  const now = input.now.getTime();
  if (start <= now || start - now > input.leadMinutes * 60_000) return false;
  if (!input.reminderSentFor) return true;
  return new Date(input.reminderSentFor).getTime() !== start;
}
