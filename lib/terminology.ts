/**
 * Portal terminology keyed by client business_type.
 * Trades values MUST match historical UI copy so trades portals stay pixel-identical.
 */

export type BusinessType = "trades" | "real_estate";

export type Terminology = {
  salesperson: string;
  salespeople: string;
  salespersonLower: string;
  project: string;
  projects: string;
  siteVisit: string;
  lead: string;
  leads: string;
  inquiry: string;
  inquiries: string;
};

const TRADES: Terminology = {
  salesperson: "Salesperson",
  salespeople: "Salespeople",
  salespersonLower: "salesperson",
  project: "Project",
  projects: "Projects",
  siteVisit: "Site visit",
  lead: "Lead",
  leads: "Leads",
  inquiry: "Lead",
  inquiries: "Leads",
};

const REAL_ESTATE: Terminology = {
  salesperson: "Agent",
  salespeople: "Agents",
  salespersonLower: "agent",
  project: "Property",
  projects: "Properties",
  siteVisit: "Viewing",
  lead: "Inquiry",
  leads: "Inquiries",
  inquiry: "Inquiry",
  inquiries: "Inquiries",
};

export function getTerminology(businessType: BusinessType | string | null | undefined): Terminology {
  return businessType === "real_estate" ? REAL_ESTATE : TRADES;
}

export function isRealEstate(businessType: BusinessType | string | null | undefined): boolean {
  return businessType === "real_estate";
}

export function normalizeBusinessType(value: unknown): BusinessType {
  return value === "real_estate" ? "real_estate" : "trades";
}
