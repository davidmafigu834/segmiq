/**
 * Per-conversation SegmiQ Agent control modes (Build 1).
 * Distinct from company-wide autonomy_mode (ASSIST/COPILOT/AUTOPILOT).
 */

export const AGENT_CONVERSATION_MODES = ["AI_HANDLING", "AI_COPILOT", "HUMAN_ONLY"] as const;
export type AgentConversationMode = (typeof AGENT_CONVERSATION_MODES)[number];

export const AGENT_CONVERSATION_MODE_LABELS: Record<AgentConversationMode, string> = {
  AI_HANDLING: "AI Handling",
  AI_COPILOT: "Copilot",
  HUMAN_ONLY: "Human Only",
};

/** Real-estate WhatsApp agent company toggles (agent_company_settings). */
export type RealEstateAgentSettings = {
  autoRespondAdInquiries: boolean;
  allowPropertySearch: boolean;
  allowSendPropertyInfo: boolean;
  allowOfferViewingSlots: boolean;
  allowConfirmViewings: boolean;
  requireViewingApproval: boolean;
  allowUpdateBuyerRequirements: boolean;
  allowCreateFollowups: boolean;
  defaultConversationMode: AgentConversationMode;
};

export const REAL_ESTATE_AGENT_SETTINGS_DEFAULTS: RealEstateAgentSettings = {
  autoRespondAdInquiries: true,
  allowPropertySearch: true,
  allowSendPropertyInfo: true,
  allowOfferViewingSlots: false,
  allowConfirmViewings: false,
  requireViewingApproval: true,
  allowUpdateBuyerRequirements: true,
  allowCreateFollowups: true,
  defaultConversationMode: "AI_HANDLING",
};

export type RealEstateListingContext = {
  id: string;
  label: string;
  transactionType: string;
  status: string;
  price: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  suburb: string | null;
  address: string | null;
  externalReference: string | null;
  agentId: string | null;
  agentName: string | null;
};

export type RealEstateAttributionContext = {
  sourceType: string;
  sourceLabel: string;
  campaignName: string | null;
  adName: string | null;
  listingId: string | null;
  formPrequalified: boolean;
  capturedAt: string;
};

export type RealEstateBuyerRequirementsContext = {
  budgetMin: number | null;
  budgetMax: number | null;
  bedroomsWanted: number | null;
  areaPreference: string | null;
  timeline: string | null;
  completeness: {
    ready: boolean;
    statusLabel: string;
    missing: string[];
    summary: string;
  };
};

export type RealEstateAgentContext = {
  dealSide: string | null;
  dealSideLabel: string | null;
  linkedListingId: string | null;
  originatingListing: RealEstateListingContext | null;
  attribution: RealEstateAttributionContext | null;
  buyerRequirements: RealEstateBuyerRequirementsContext | null;
};
