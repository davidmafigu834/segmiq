import type { LeadSource, LeadStatus } from "@/types";

export type InboxFilter = "all" | "unassigned" | "mine" | "hot";

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
  phone: string | null;
  location: string | null;
  source: LeadSource | string | null;
  status: LeadStatus | string;
  stageLabel: string;
  projectType: string | null;
  assignedToId: string | null;
  assignee: InboxAssignee | null;
  score: number;
  scoreLabel: "Hot" | "Warm" | "Cold";
  lastMessage: string;
  lastMessageAt: string;
  unread: number;
  tags: string[];
  leadSummary: string | null;
  breakdown: InboxScoreBreakdown;
  followUpDate: string | null;
  createdAt: string;
};

export type InboxChatMessage = {
  id: string;
  direction: "customer" | "rep";
  text: string;
  createdAt: string;
  kind: "message" | "system";
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
