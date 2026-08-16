import type { QuotationStatus } from "@/types";

export type CompanyQuotationTab =
  | "all"
  | "draft"
  | "sent"
  | "viewed"
  | "accepted"
  | "declined";

export type CompanyQuotationOwner = {
  id: string;
  name: string;
  avatarUrl: string | null;
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
  createdAt: string;
  updatedAt: string;
  publicToken: string | null;
};

export type CompanyQuotationFilterOption = {
  id: string;
  label: string;
};

export type CompanyQuotationsPageData = {
  clientId: string;
  clientName: string;
  currency: string;
  viewedTrackingEnabled: boolean;
  rows: CompanyQuotationRow[];
  counts: Record<CompanyQuotationTab, number>;
  totalValue: number;
  owners: CompanyQuotationOwner[];
  customers: CompanyQuotationFilterOption[];
  deals: CompanyQuotationFilterOption[];
  hasTemplates: boolean;
  createCandidates: Array<{
    id: string;
    name: string | null;
    phone: string | null;
    projectType: string | null;
    clientId: string;
    status: string;
  }>;
};
