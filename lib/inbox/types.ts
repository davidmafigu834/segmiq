import type { LeadSource, LeadStatus } from "@/types";

export type InboxFilter =
  | "all"
  | "open"
  | "new"
  | "resolved"
  | "unread"
  | "unassigned"
  | "mine"
  | "hot"
  | "warm"
  | "cold"
  | "no_deal"
  | "deal_qualified"
  | "deal_scoping"
  | "deal_proposal_sent"
  | "deal_negotiating"
  | "follow_up_due"
  | "awaiting_reply"
  | "waiting_customer"
  | "quotes_sent";

export type InboxAssignee = {
  id: string;
  name: string;
};

export type InboxScoreBreakdown = {
  urgency: number;
  budget: number;
  location: number;
  productInterest: number;
  engagement: number;
};

export type InboxConversation = {
  id: string;
  contactId: string | null;
  name: string | null;
  whatsappProfileName: string | null;
  phone: string | null;
  location: string | null;
  source: LeadSource | string | null;
  status: LeadStatus | string;
  stageLabel: string;
  projectType: string | null;
  leadBudget: string | null;
  leadTimeline: string | null;
  assignedToId: string | null;
  assignee: InboxAssignee | null;
  score: number;
  scoreLabel: "Hot" | "Warm" | "Cold";
  lastMessage: string;
  lastMessageAt: string;
  lastMessageType: string | null;
  unread: number;
  tags: string[];
  leadSummary: string | null;
  breakdown: InboxScoreBreakdown;
  followUpDate: string | null;
  createdAt: string;
  company: string | null;
  dealValue: number | null;
  dealCurrency: string | null;
  sourceLabel: string;
  lastMessageDirection: "inbound" | "outbound" | null;
  awaitingReplyMinutes: number | null;
  latestQuoteNumber: string | null;
  latestQuoteStatus: string | null;
  latestQuoteTotal: number | null;
  /** Conversation workflow is intentionally separate from Lead/Deal lifecycle. */
  conversationStatus: "OPEN" | "RESOLVED";
  resolvedAt: string | null;
  firstContactAt: string;
  firstResponseSeconds: number | null;
  messageCount: number;
  activeDealId: string | null;
  dealName: string | null;
  dealStage: string | null;
  dealNextActionAt: string | null;
};

export type CompanyWhatsAppSummary = {
  active: number;
  newConversations: number;
  avgFirstResponseSeconds: number | null;
  resolved: number;
  unassigned: number;
  waitingOnTeam: number;
  periodDays: number;
};

export type CompanyConversationActivity = {
  id: string;
  actorName: string;
  label: string;
  createdAt: string;
};

export type CompanyConversationContext = {
  contact: {
    name: string | null;
    phone: string | null;
    email: string | null;
    location: string | null;
    lifecycle: string | null;
  };
  insights: {
    firstContactAt: string;
    messageCount: number;
    firstResponseSeconds: number | null;
    status: "OPEN" | "WAITING_ON_TEAM" | "WAITING_ON_CUSTOMER" | "RESOLVED";
  };
  deal: {
    id: string;
    name: string;
    stage: string;
    value: number | null;
    currency: string | null;
  } | null;
  quoteCount: number;
  activity: CompanyConversationActivity[];
};

export type InboxChatMessage = {
  id: string;
  direction: "customer" | "rep";
  text: string;
  createdAt: string;
  kind: "message" | "system" | "internal";
  messageType?: string | null;
  status?: "pending" | "sent" | "delivered" | "read" | "failed" | null;
  mediaUrl?: string | null;
  mediaMimeType?: string | null;
};

export type InboxIntelligence = {
  intentScore: number;
  scoreLabel: "Hot" | "Warm" | "Cold";
  breakdown: InboxScoreBreakdown;
  leadSummary: string | null;
  nextAction: string | null;
  tags: string[];
  urgencyLevel: string | null;
  locationExtracted: string | null;
  intentCategory: string | null;
  projectType: string | null;
  phone: string | null;
  source: string | null;
  assignee: InboxAssignee | null;
  followUpDate: string | null;
  slaActive: boolean;
};
