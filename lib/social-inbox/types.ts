/**
 * Social Inbox domain types.
 * Social Opportunity ≠ CRM Lead. A conversation can exist without becoming a lead.
 */

import type { UserRole } from "@/types";

export const SOCIAL_PROVIDERS = ["facebook", "instagram"] as const;
export type SocialProvider = (typeof SOCIAL_PROVIDERS)[number];

export const SOCIAL_CHANNELS = [
  "facebook_messenger",
  "facebook_comment",
  "facebook_ad_comment",
  "instagram_dm",
  "instagram_comment",
  "instagram_ad_comment",
] as const;
export type SocialChannel = (typeof SOCIAL_CHANNELS)[number];

export const SOCIAL_CONVERSATION_KINDS = ["dm", "comment"] as const;
export type SocialConversationKind = (typeof SOCIAL_CONVERSATION_KINDS)[number];

export const SOCIAL_CONVERSATION_STATUSES = [
  "open",
  "waiting_for_customer",
  "needs_reply",
  "follow_up_required",
  "resolved",
  "archived",
] as const;
export type SocialConversationStatus = (typeof SOCIAL_CONVERSATION_STATUSES)[number];

export const SOCIAL_OPPORTUNITY_STATUSES = [
  "new",
  "reviewing",
  "contacted",
  "qualified",
  "converted",
  "not_a_lead",
  "disqualified",
] as const;
export type SocialOpportunityStatus = (typeof SOCIAL_OPPORTUNITY_STATUSES)[number];

export const SOCIAL_INTENT_SIGNALS = [
  "PRICING_INTENT",
  "PRODUCT_INTEREST",
  "AVAILABILITY_INTENT",
  "FINANCING_INTENT",
  "PURCHASE_INTENT",
  "QUOTATION_REQUEST",
  "LOCATION_QUERY",
  "DELIVERY_QUERY",
  "INSTALLATION_QUERY",
  "SPECIFICATION_QUERY",
  "CALLBACK_REQUEST",
  "FOLLOW_UP_COMMITMENT",
  "OBJECTION",
  "COMPARISON",
  "SUPPORT_REQUEST",
  "SPAM",
  "LOW_VALUE_ENGAGEMENT",
  "OTHER",
] as const;
export type SocialIntentSignalType = (typeof SOCIAL_INTENT_SIGNALS)[number];

export const SOCIAL_INBOX_VIEWS = [
  "for_you",
  "hot",
  "needs_reply",
  "follow_up",
  "dms",
  "comments",
  "converted",
  "unassigned",
] as const;
export type SocialInboxViewId = (typeof SOCIAL_INBOX_VIEWS)[number];

export type SocialIntentBand = "hot" | "warm" | "cold";

export type SocialConnectionStatus =
  | "connected"
  | "attention_required"
  | "disconnected"
  | "auth_expired"
  | "sync_issue";

export type SocialOrigin = {
  kind: "organic" | "advertisement" | "post" | "reel" | "story" | "unknown";
  campaignName: string | null;
  campaignId: string | null;
  adName: string | null;
  adId: string | null;
  postId: string | null;
  permalink: string | null;
  caption: string | null;
  customerQuote: string | null;
};

export type SocialIntentSignal = {
  type: SocialIntentSignalType;
  confidence: number;
  evidence: string | null;
  source: "rules" | "ai" | "human";
};

export type IntentClassification = {
  score: number;
  band: SocialIntentBand;
  signals: SocialIntentSignal[];
  reasons: string[];
  detectedProduct: string | null;
  detectedLocation: string | null;
  recommendedAction: string | null;
  recommendedActionCode: string | null;
  followUpHint: string | null;
  isOpportunity: boolean;
};

export type SafeSocialConnection = {
  id: string;
  provider: SocialProvider;
  channelKind: "page" | "ig_business";
  status: SocialConnectionStatus;
  displayName: string | null;
  username: string | null;
  pageId: string | null;
  igAccountId: string | null;
  scopesOk: boolean;
  lastSyncAt: string | null;
  lastEventAt: string | null;
  lastError: string | null;
  isDemo: boolean;
};

export type SocialQueueItem = {
  conversationId: string;
  opportunityId: string | null;
  displayName: string;
  username: string | null;
  avatarUrl: string | null;
  channel: SocialChannel;
  conversationKind: SocialConversationKind;
  visibility: "public" | "private";
  preview: string;
  lastMessageAt: string | null;
  unread: boolean;
  assignedToId: string | null;
  assignedToName: string | null;
  intentScore: number;
  intentBand: SocialIntentBand;
  intentReasons: string[];
  detectedProduct: string | null;
  followUpLabel: string | null;
  crmState: "none" | "existing_customer" | "open_deal" | "converted";
  primaryLabel: string | null;
  origin: SocialOrigin | null;
  isDemo: boolean;
  rankScore: number;
};

export type SocialInboxIndicators = {
  highIntent: number;
  awaitingReply: number;
  followUpsDue: number;
  openDealsNeedingAttention: number;
};

export type SocialMessageDto = {
  id: string;
  direction: "inbound" | "outbound";
  visibility: "public" | "private";
  body: string;
  isInternalNote: boolean;
  sendStatus: "pending" | "sending" | "sent" | "delivered" | "failed";
  sendError: string | null;
  aiDraft: boolean;
  sentAt: string;
  actorName: string | null;
};

export type SocialMatchCandidate = {
  contactId: string | null;
  leadId: string | null;
  dealId: string | null;
  name: string;
  reason: string;
  confidence: "high" | "medium" | "low";
  openDealName: string | null;
  previousEnquiryCount: number;
};

export type SocialIntelligence = {
  displayName: string;
  username: string | null;
  avatarUrl: string | null;
  channel: SocialChannel;
  assignedToName: string | null;
  intentScore: number;
  intentBand: SocialIntentBand;
  reasons: string[];
  signals: SocialIntentSignalType[];
  detectedProduct: string | null;
  detectedLocation: string | null;
  origin: SocialOrigin | null;
  crm: {
    state: "none" | "existing_customer" | "open_deal" | "converted";
    contactId: string | null;
    leadId: string | null;
    dealId: string | null;
    customerName: string | null;
    openDealName: string | null;
    match: SocialMatchCandidate | null;
  };
  nextAction: {
    label: string;
    code: string | null;
    followUpAt: string | null;
    followUpReason: string | null;
  };
  summary: string | null;
};

export type SocialConversationDetail = {
  conversation: SocialQueueItem;
  messages: SocialMessageDto[];
  intelligence: SocialIntelligence;
  replyMode: "public_comment" | "private_dm";
  canReply: boolean;
  canConvert: boolean;
  canCreateDeal: boolean;
  canCreateQuote: boolean;
  canAssign: boolean;
};

export type SocialInboxWorkspace = {
  view: SocialInboxViewId;
  items: SocialQueueItem[];
  nextCursor: string | null;
  indicators: SocialInboxIndicators;
  connections: SafeSocialConnection[];
  connectionState: "none" | "demo" | "connected" | "attention";
  canViewUnassigned: boolean;
  canManageChannels: boolean;
  canAssign: boolean;
  canReply: boolean;
  team: { id: string; name: string }[];
  isDemo: boolean;
};

export type SocialInboxActor = {
  userId: string;
  role: UserRole;
  clientId: string;
  alsoSells?: boolean;
  name?: string | null;
};

export type SocialInboxFilters = {
  channel?: SocialChannel | "facebook" | "instagram" | null;
  assignedToId?: string | null;
  intentBand?: SocialIntentBand | null;
  signal?: SocialIntentSignalType | null;
  converted?: boolean | null;
  existingCustomer?: boolean | null;
  openDeal?: boolean | null;
  q?: string | null;
};
