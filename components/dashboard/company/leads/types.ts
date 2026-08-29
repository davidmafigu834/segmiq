import type { SalesKpiItem } from "@/components/dashboard/sales/types";
import type { LeadScoreBand } from "@/lib/sales/format";
import type { LeadRow, LeadStatus } from "@/types";
import type { BusinessType } from "@/lib/terminology";

export type CompanyLeadsTab =
  | "all"
  | "new"
  | "hot"
  | "contacted"
  | "qualified"
  | "not_qualified";

export type CompanyLeadsSort =
  | "newest"
  | "oldest"
  | "score"
  | "last_activity"
  | "next_action"
  | "response_urgency";

export type CompanyLeadsIntentFilter = "all" | "hot" | "warm" | "cold";
export type CompanyLeadsDealFilter = "all" | "has_deal" | "no_deal";
export type CompanyLeadsContactFilter = "all" | "contacted" | "not_contacted";
export type CompanyLeadsLifecycleFilter = "all" | LeadStatus;

export type CompanyLeadsFilters = {
  ownerId: string | "all" | "unassigned";
  source: string | "all";
  lifecycle: CompanyLeadsLifecycleFilter;
  intent: CompanyLeadsIntentFilter;
  hasDeal: CompanyLeadsDealFilter;
  firstContact: CompanyLeadsContactFilter;
};

export const DEFAULT_COMPANY_LEADS_FILTERS: CompanyLeadsFilters = {
  ownerId: "all",
  source: "all",
  lifecycle: "all",
  intent: "all",
  hasDeal: "all",
  firstContact: "all",
};

export type CompanyLeadsOwnerOption = {
  id: string;
  name: string;
  avatarUrl: string | null;
};

export type CompanyLeadsSourceOption = {
  key: string;
  label: string;
};

export type CompanyLeadsNextActionView = {
  hasNextAction: boolean;
  isOverdue: boolean;
  label: string | null;
  at: string | null;
  whenLabel: string | null;
  urgency: "overdue" | "today" | "tomorrow" | "soon" | "later" | null;
  completable: boolean;
};

export type CompanyLeadScoreSignal = {
  id: string;
  label: string;
  done: boolean;
};

export type CompanyLeadRow = {
  id: string;
  identity: string;
  enquiryContext: string | null;
  location: string | null;
  sourceKey: string | null;
  sourceLabel: string | null;
  sourceRaw: string | null;
  phone: string | null;
  email: string | null;
  lifecycle: LeadStatus;
  lifecycleLabel: string;
  leadScore: number | null;
  intent: LeadScoreBand | null;
  intentLabel: string | null;
  ownerId: string | null;
  ownerName: string | null;
  ownerAvatarUrl: string | null;
  createdAt: string;
  createdLabel: string;
  firstContactAt: string | null;
  lastActivityAt: string | null;
  followUpAt: string | null;
  nextAction: CompanyLeadsNextActionView;
  hasDeal: boolean;
  activeDealId: string | null;
  contactId: string | null;
  customerWaiting: boolean;
  canModify: boolean;
  dealSide?: string | null;
  reStage?: string | null;
  reStageLabel?: string | null;
  requirementSummary?: string | null;
  budgetLabel?: string | null;
  linkedListingLabel?: string | null;
};

export type CompanyLeadRelatedDeal = {
  id: string;
  name: string;
  stage: string;
  stageLabel: string;
  valueLabel: string | null;
};

export type CompanyLeadDetail = {
  id: string;
  identity: string;
  enquiryContext: string | null;
  location: string | null;
  lifecycle: LeadStatus;
  lifecycleLabel: string;
  notQualifiedReason: string | null;
  phone: string | null;
  email: string | null;
  telHref: string | null;
  mailtoHref: string | null;
  whatsappHref: string | null;
  canCall: boolean;
  canWhatsApp: boolean;
  canEmail: boolean;
  leadScore: number | null;
  intent: LeadScoreBand | null;
  intentLabel: string | null;
  scoreSignals: CompanyLeadScoreSignal[];
  sourceKey: string | null;
  sourceLabel: string | null;
  ownerId: string | null;
  ownerName: string | null;
  ownerAvatarUrl: string | null;
  firstContactAt: string | null;
  firstContactLabel: string;
  lastActivityAt: string | null;
  lastActivityLabel: string;
  customerNeed: string | null;
  nextAction: CompanyLeadsNextActionView;
  customerWaiting: boolean;
  hasDeal: boolean;
  relatedDeal: CompanyLeadRelatedDeal | null;
  canModify: boolean;
  canReassign: boolean;
  canCreateDeal: boolean;
  viewDetailsHref: string | null;
  openDealHref: string | null;
  leadForDeal: LeadRow | null;
};

export type CompanyLeadsTabCounts = Record<CompanyLeadsTab, number>;

export type CompanyLeadsPageData = {
  clientId: string;
  clientName: string;
  businessType: BusinessType;
  actorUserId: string;
  alsoSells: boolean;
  canReassign: boolean;
  canAddLead: boolean;
  kpis: SalesKpiItem[];
  rows: CompanyLeadRow[];
  tabCounts: CompanyLeadsTabCounts;
  owners: CompanyLeadsOwnerOption[];
  sources: CompanyLeadsSourceOption[];
};
