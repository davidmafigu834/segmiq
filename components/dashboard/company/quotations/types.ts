import type { MarginHealthState, QuotationApprovalStatus, QuotationStatus } from "@/types";

export type CompanyQuotationTab =
  | "all"
  | "needs_attention"
  | "pending_approval"
  | "sent"
  | "accepted"
  | "declined"
  | "expired";

export type CompanyQuotationOwner = {
  id: string;
  name: string;
  avatarUrl: string | null;
};

export type CompanyQuotationEngagement =
  | "not_sent"
  | "sent"
  | "viewed"
  | "changes_requested"
  | "accepted"
  | "declined";

export type CompanyQuotationVersionRef = {
  id: string;
  revisionNumber: number;
  amount: number;
  status: string;
};

export type CompanyQuotationRow = {
  id: string;
  clientId: string;
  leadId: string;
  contactId: string | null;
  dealId: string | null;
  quoteNumber: string | null;
  revisionNumber: number;
  title: string;
  customerName: string;
  customerPhone: string | null;
  customerEmail: string | null;
  dealName: string | null;
  dealStage: string | null;
  dealValue: number | null;
  amount: number;
  currency: string;
  status: QuotationStatus;
  effectiveStatus: QuotationStatus;
  owner: CompanyQuotationOwner | null;
  preparedByName: string | null;
  quoteDate: string;
  validUntil: string | null;
  sentAt: string | null;
  viewedAt: string | null;
  lastViewedAt: string | null;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
  publicToken: string | null;
  approvalStatus: QuotationApprovalStatus | string | null;
  approvalNote: string | null;
  approvalReasons: string[];
  approvalRequestedAt: string | null;
  approvedAt: string | null;
  approvedByName: string | null;
  discountPercent: number | null;
  discountExceedsAuthority: boolean;
  maxDiscountPercent: number | null;
  minMarginPercent: number | null;
  marginPercent: number | null;
  marginHealth: MarginHealthState;
  costTotal: number | null;
  standardValue: number | null;
  subtotal: number | null;
  taxAmount: number | null;
  otherAmount: number | null;
  customerResponseType: string | null;
  customerResponseCategory: string | null;
  customerResponseMessage: string | null;
  acceptedTotal: number | null;
  declinedReason: string | null;
  parentQuotationId: string | null;
  previousVersion: CompanyQuotationVersionRef | null;
  selectedOptionLabel: string | null;
};

export type CompanyQuotationAttention = {
  pendingApproval: number;
  pendingApprovalValue: number;
  needsAttention: number;
  awaitingCustomer: number;
  acceptedValue: number;
  expiringSoon: number;
};

export type CompanyQuotationPermissions = {
  alsoSells: boolean;
  canApprove: boolean;
  canSeeMargin: boolean;
  canSeeCost: boolean;
  canSeeMarginPercent: boolean;
  canManageSettings: boolean;
};

export type CompanyQuotationFilterOption = {
  id: string;
  label: string;
};

export type CompanyQuotationsPageData = {
  clientId: string;
  clientName: string;
  currency: string;
  currencies: string[];
  viewedTrackingEnabled: boolean;
  rows: CompanyQuotationRow[];
  counts: Record<CompanyQuotationTab, number>;
  attention: CompanyQuotationAttention;
  totalValue: number;
  owners: CompanyQuotationOwner[];
  customers: CompanyQuotationFilterOption[];
  deals: CompanyQuotationFilterOption[];
  hasTemplates: boolean;
  permissions: CompanyQuotationPermissions;
  createCandidates: Array<{
    id: string;
    name: string | null;
    phone: string | null;
    projectType: string | null;
    clientId: string;
    status: string;
  }>;
};
