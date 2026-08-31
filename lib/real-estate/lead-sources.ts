import type { SalesKpiItem } from "@/components/dashboard/sales/types";
import { formatConversionPct, type ReSourceType } from "@/lib/real-estate/marketing";

export type LeadSourceCompanyTab = "all" | "paid" | "inbound" | "relationship" | "other";

export const LEAD_SOURCE_COMPANY_TABS: { id: LeadSourceCompanyTab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "paid", label: "Paid" },
  { id: "inbound", label: "Inbound" },
  { id: "relationship", label: "Relationship" },
  { id: "other", label: "Other" },
];

export const LEAD_SOURCE_DATE_PRESETS = [
  { id: "today", label: "Today" },
  { id: "last_7", label: "Last 7 days" },
  { id: "this_month", label: "This month" },
  { id: "last_month", label: "Last month" },
] as const;

export type LeadSourceDatePreset = (typeof LEAD_SOURCE_DATE_PRESETS)[number]["id"];

export type LeadSourceCompanySort = "inquiries_desc" | "conversion_desc" | "source_asc";

export type LeadSourceRow = {
  sourceType: string;
  label: string;
  inquiries: number;
  qualified: number;
  viewings: number;
  offers: number;
  accepted: number;
  conversion: number | null;
};

const PAID: ReSourceType[] = ["facebook_ads", "instagram_ads"];
const INBOUND: ReSourceType[] = ["website", "whatsapp", "property_portal", "phone"];
const RELATIONSHIP: ReSourceType[] = ["referral", "walk_in"];

export function parseLeadSourceDatePreset(value: string | null | undefined): LeadSourceDatePreset {
  if (value === "today" || value === "last_7" || value === "last_month" || value === "this_month") {
    return value;
  }
  return "this_month";
}

export function parseLeadSourceCompanyTab(value: string | null | undefined): LeadSourceCompanyTab | null {
  if (value === "all" || value === "paid" || value === "inbound" || value === "relationship" || value === "other") {
    return value;
  }
  return null;
}

export function leadSourceTabForType(sourceType: string): Exclude<LeadSourceCompanyTab, "all"> {
  if ((PAID as string[]).includes(sourceType)) return "paid";
  if ((INBOUND as string[]).includes(sourceType)) return "inbound";
  if ((RELATIONSHIP as string[]).includes(sourceType)) return "relationship";
  return "other";
}

export function leadSourceMatchesTab(sourceType: string, tab: LeadSourceCompanyTab): boolean {
  if (tab === "all") return true;
  return leadSourceTabForType(sourceType) === tab;
}

export function leadSourceTabCounts(rows: LeadSourceRow[]): Record<LeadSourceCompanyTab, number> {
  const next: Record<LeadSourceCompanyTab, number> = {
    all: rows.length,
    paid: 0,
    inbound: 0,
    relationship: 0,
    other: 0,
  };
  for (const row of rows) {
    next[leadSourceTabForType(row.sourceType)] += 1;
  }
  return next;
}

export function leadSourceMatchesSearch(row: LeadSourceRow, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return `${row.label} ${row.sourceType}`.toLowerCase().includes(q);
}

export function sortLeadSourceRows(rows: LeadSourceRow[], sort: LeadSourceCompanySort): LeadSourceRow[] {
  const copy = [...rows];
  copy.sort((a, b) => {
    if (sort === "conversion_desc") return (b.conversion ?? -1) - (a.conversion ?? -1);
    if (sort === "source_asc") return a.label.localeCompare(b.label, undefined, { sensitivity: "base" });
    return b.inquiries - a.inquiries;
  });
  return copy;
}

export function leadSourceCompanyKpis(funnel: {
  inquiries: number;
  qualified: number;
  viewings: number;
  offers: number;
  accepted: number;
  conversion: number | null;
}): SalesKpiItem[] {
  return [
    {
      id: "inquiries",
      label: "Inquiries",
      value: String(funnel.inquiries),
      supporting: "Acquired this period",
      icon: "enquiries",
    },
    {
      id: "qualified",
      label: "Qualified",
      value: String(funnel.qualified),
      supporting: funnel.inquiries ? `${formatConversionPct(Math.round((funnel.qualified / funnel.inquiries) * 1000) / 10)} of inquiries` : "No inquiries yet",
      icon: "conversion",
    },
    {
      id: "viewings",
      label: "Viewings",
      value: String(funnel.viewings),
      supporting: "From this cohort",
      icon: "followups",
    },
    {
      id: "offers",
      label: "Offers",
      value: String(funnel.offers),
      supporting: `${funnel.accepted} accepted`,
      icon: "deals",
    },
    {
      id: "conversion",
      label: "Conversion",
      value: formatConversionPct(funnel.conversion),
      supporting: "Inquiry to accepted offer",
      icon: "won",
    },
  ];
}
