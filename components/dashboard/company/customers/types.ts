import type { SalesKpiItem } from "@/components/dashboard/sales/types";

export type CompanyCustomerType = "company" | "individual" | "unclassified";
export type CompanyCustomersTab = "all" | "companies" | "individuals" | "recent";
export type CompanyCustomersSort =
  | "recent_interaction"
  | "customer_asc"
  | "customer_desc"
  | "value_desc"
  | "value_asc"
  | "deals_desc"
  | "customer_since";

export type CompanyCustomersFilters = {
  customerType: "all" | CompanyCustomerType;
  ownerId: string | "all" | "unassigned";
  activeDeals: "all" | "yes" | "no";
  customerValue: "all" | "known" | "not_recorded";
};

export const DEFAULT_COMPANY_CUSTOMERS_FILTERS: CompanyCustomersFilters = {
  customerType: "all",
  ownerId: "all",
  activeDeals: "all",
  customerValue: "all",
};

export type CompanyCustomersOwnerOption = {
  id: string;
  name: string;
  avatarUrl: string | null;
};

export type CompanyCustomerRow = {
  id: string;
  name: string;
  customerType: CompanyCustomerType;
  customerTypeLabel: string;
  industry: string | null;
  primaryContactName: string | null;
  phone: string | null;
  email: string | null;
  location: string | null;
  source: string | null;
  ownerId: string | null;
  ownerName: string | null;
  ownerAvatarUrl: string | null;
  customerSince: string;
  customerSinceLabel: string;
  lastInteractionAt: string | null;
  lastInteractionLabel: string;
  lastInteractionChannel: string | null;
  totalDeals: number;
  activeDeals: number;
  activePipelineKnown: number;
  activePipelineUnknownCount: number;
  wonDeals: number;
  wonValueKnown: number;
  wonValueUnknownCount: number;
  customerValueLabel: string;
};

export type CompanyCustomerActivity = {
  id: string;
  kind: "whatsapp" | "call" | "quote" | "deal" | "other";
  title: string;
  detail: string | null;
  createdAt: string;
  timeLabel: string;
};

export type CompanyCustomerDetail = CompanyCustomerRow & {
  telHref: string | null;
  mailtoHref: string | null;
  whatsappHref: string | null;
  canCall: boolean;
  canWhatsApp: boolean;
  canEmail: boolean;
  recentActivity: CompanyCustomerActivity[];
  viewDetailsHref: string;
  viewDealsHref: string;
};

export type CompanyCustomersTabCounts = Record<CompanyCustomersTab, number>;

export type CompanyCustomersPageData = {
  clientId: string;
  clientName: string;
  currency: string;
  canAddCustomer: boolean;
  kpis: SalesKpiItem[];
  rows: CompanyCustomerRow[];
  tabCounts: CompanyCustomersTabCounts;
  owners: CompanyCustomersOwnerOption[];
};
