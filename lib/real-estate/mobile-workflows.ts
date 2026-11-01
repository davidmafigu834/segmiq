import { canSeeBuyerContact } from "@/lib/real-estate/buyer-match";
import { privateListingImageKey } from "@/lib/real-estate/listing-access";

const BUYER_FIELDS = [
  "id",
  "client_id",
  "contact_id",
  "assigned_agent_id",
  "intent",
  "property_type",
  "property_categories",
  "budget_min",
  "budget_max",
  "currency",
  "locations",
  "bedrooms",
  "bathrooms",
  "land_size",
  "building_size",
  "features",
  "amenities",
  "other_requirements",
  "timeframe",
  "readiness",
  "lease_months",
  "move_in_date",
  "allow_above_budget",
  "pipeline_stage",
  "status",
  "next_action_at",
  "next_action_note",
  "created_at",
  "updated_at",
] as const;

/**
 * Authorised buyer-search projection. Another agent's row keeps the id and
 * status only. Phone is included only for the owner or a manager.
 */
export function buyerSearchMobileDto(
  row: Record<string, unknown>,
  actor: { id: string; role: string },
  contact: { name?: string | null; phone?: string | null } | null,
  agentName?: string | null
): Record<string, unknown> {
  const ownerId = (row.assigned_agent_id as string | null) ?? null;
  const authorised = canSeeBuyerContact({
    requesterId: actor.id,
    ownerAgentId: ownerId,
    role: actor.role,
    introductionAccepted: false,
  });
  const manager = actor.role === "CLIENT_MANAGER" || actor.role === "SUPER_ADMIN";
  if (!authorised) {
    return {
      id: String(row.id),
      status: (row.status as string | null) ?? null,
      pipeline_stage: (row.pipeline_stage as string | null) ?? null,
      assigned_agent_id: ownerId,
      permittedActions: [],
    };
  }
  const dto: Record<string, unknown> = {};
  for (const key of BUYER_FIELDS) {
    if (key in row) dto[key] = row[key];
  }
  dto.id = String(row.id);
  if (!Array.isArray(dto.locations)) dto.locations = [];
  if (contact?.name) dto.contact_name = contact.name;
  if (contact?.phone) dto.phone = contact.phone;
  if (agentName) dto.agent_name = agentName;
  const actions = ["edit"];
  if (manager) actions.push("reassign");
  dto.permittedActions = actions;
  return dto;
}

export function bearerListingPhotoError(
  photos: string[] | undefined,
  clientId: string,
  listingId: string | null
): { error: string; code: "USE_PRIVATE_IMAGE_UPLOAD" } | null {
  if (!photos?.length) return null;
  if (!listingId || photos.some((photo) => !privateListingImageKey(photo, clientId, listingId))) {
    return {
      error: listingId
        ? "Photographs must already be private images on this listing, or use the upload endpoint."
        : "Attach photographs with the private image upload after the listing exists.",
      code: "USE_PRIVATE_IMAGE_UPLOAD",
    };
  }
  return null;
}

export type ListingBuyerRelationship = "own" | "introduced" | "other_agent" | "unassigned";

/** Match card for a listing. Compatibility flags only; no private requirement values. */
export function listingBuyerMatchAccess(input: {
  actorId: string;
  actorRole: string;
  ownerAgentId: string | null;
  visible: boolean;
  introductionStatus: string | null;
  searchStatus: string | null;
  budgetCompatible: boolean;
  locationCompatible: boolean;
  requirementsCompatible: boolean;
}): {
  searchStatus: string | null;
  relationship: ListingBuyerRelationship;
  budgetCompatible: boolean;
  locationCompatible: boolean;
  requirementsCompatible: boolean;
  permittedActions: string[];
  scoreMeaning: "rules_points";
} {
  const manager = input.actorRole === "CLIENT_MANAGER" || input.actorRole === "SUPER_ADMIN";
  const own = Boolean(input.ownerAgentId && input.ownerAgentId === input.actorId);
  const introduced = input.visible && !own && !manager && input.introductionStatus === "accepted";
  const relationship: ListingBuyerRelationship = own
    ? "own"
    : !input.ownerAgentId
      ? "unassigned"
      : introduced
        ? "introduced"
        : "other_agent";
  const permittedActions: string[] = [];
  if (own || (manager && input.visible)) permittedActions.push("open_buyer");
  else if (introduced) permittedActions.push("view_introduced_contact");
  else if (!input.visible && !input.introductionStatus) permittedActions.push("request_introduction");
  return {
    searchStatus: input.searchStatus,
    relationship,
    budgetCompatible: input.budgetCompatible,
    locationCompatible: input.locationCompatible,
    requirementsCompatible: input.requirementsCompatible,
    permittedActions,
    scoreMeaning: "rules_points",
  };
}

/** Conversation Copilot contract. Approval never sends a customer message. */
export function copilotConversationContract(leadId: string) {
  return {
    conversation: { leadId, scope: "assigned_conversation" as const },
    customerDelivery: "NOT_PERFORMED" as const,
    sendsCustomerMessage: false as const,
    approvalRequired: true as const,
    suggestedResponsesAreDrafts: true as const,
  };
}
