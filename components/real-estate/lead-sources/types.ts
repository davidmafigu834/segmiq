import type { SalesKpiItem } from "@/components/dashboard/sales/types";
import type { LeadSourceCompanyTab, LeadSourceDatePreset, LeadSourceRow } from "@/lib/real-estate/lead-sources";

export type CompanyLeadSourcesPageData = {
  clientId: string;
  clientName: string;
  rangeLabel: string;
  preset: LeadSourceDatePreset;
  kpis: SalesKpiItem[];
  rows: LeadSourceRow[];
  tabCounts: Record<LeadSourceCompanyTab, number>;
  funnel: {
    inquiries: number;
    qualified: number;
    viewings: number;
    offers: number;
    accepted: number;
    conversion: number | null;
  };
};
