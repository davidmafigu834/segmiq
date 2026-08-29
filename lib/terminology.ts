/**
 * Portal terminology keyed by client business_type.
 * Trades values MUST match historical UI copy so trades portals stay pixel-identical.
 * Database field names are never renamed — this is presentation only.
 */

import type { DealSide } from "@/types";

export type BusinessType = "trades" | "real_estate";

export type TermPair = {
  singular: string;
  plural: string;
};

export type Terminology = {
  lead: TermPair;
  salesperson: TermPair;
  project: TermPair;
  siteVisit: TermPair;
  team: TermPair;
  /** Short labels used in buttons / empty states */
  actions: {
    addLead: string;
    viewLead: string;
    assign: string;
    searchLeads: string;
  };
};

const TRADES: Terminology = {
  lead: { singular: "Lead", plural: "Leads" },
  salesperson: { singular: "Salesperson", plural: "Salespeople" },
  project: { singular: "Project", plural: "Projects" },
  siteVisit: { singular: "Site Visit", plural: "Site Visits" },
  team: { singular: "Team", plural: "Team" },
  actions: {
    addLead: "Add Lead",
    viewLead: "View Lead",
    assign: "Assign salesperson",
    searchLeads: "Search Leads...",
  },
};

const REAL_ESTATE: Terminology = {
  lead: { singular: "Inquiry", plural: "Inquiries" },
  salesperson: { singular: "Agent", plural: "Agents" },
  project: { singular: "Property", plural: "Properties" },
  siteVisit: { singular: "Viewing", plural: "Viewings" },
  team: { singular: "Agent", plural: "Agents" },
  actions: {
    addLead: "Add Inquiry",
    viewLead: "View Inquiry",
    assign: "Assign agent",
    searchLeads: "Search Inquiries...",
  },
};

export function getTerminology(
  businessType: BusinessType | string | null | undefined
): Terminology {
  return businessType === "real_estate" ? REAL_ESTATE : TRADES;
}

export function isRealEstate(businessType: unknown): boolean {
  return businessType === "real_estate";
}

export function normalizeBusinessType(value: unknown): BusinessType {
  return value === "real_estate" ? "real_estate" : "trades";
}

const DEAL_SIDE_BADGE: Record<DealSide, string> = {
  buy_side: "BUYER",
  sell_side: "SELLER",
  landlord_side: "LANDLORD",
  tenant_side: "TENANT",
};

/** Presentation badge for leads.deal_side. Returns null when unset or unknown. */
export function dealSideBadgeLabel(side: string | null | undefined): string | null {
  if (!side) return null;
  return DEAL_SIDE_BADGE[side as DealSide] ?? null;
}

/** Display-time remap of stored role labels. Does not change DB values. */
export function displayRoleColumn(
  roleColumn: string,
  businessType: BusinessType | string | null | undefined
): string {
  if (!isRealEstate(businessType)) return roleColumn;
  if (roleColumn === "Salesperson") return "Agent";
  if (roleColumn === "Sales Manager") return "Sales Manager";
  if (roleColumn === "Sales Executive") return "Agent";
  return roleColumn;
}

export function displayTitleLabel(
  titleLabel: string,
  businessType: BusinessType | string | null | undefined
): string {
  if (!isRealEstate(businessType)) return titleLabel;
  if (titleLabel === "Sales Executive") return "Agent";
  return titleLabel;
}

/** Display-time remap of team composition slice labels. Does not change metrics. */
export function displayCompositionLabel(
  label: string,
  businessType: BusinessType | string | null | undefined
): string {
  if (!isRealEstate(businessType)) return label;
  if (label === "Salespeople") return "Agents";
  return label;
}
