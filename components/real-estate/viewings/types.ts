import type { SalesKpiItem } from "@/components/dashboard/sales/types";
import type { ViewingCompanyTab } from "@/lib/real-estate/viewings";

export type ViewingWorkspaceRow = {
  id: string;
  scheduled_at: string;
  status: string;
  feedback_text: string | null;
  feedback_sentiment: string | null;
  agent_id: string | null;
  agent_name: string | null;
  contact_id: string;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  listing_id: string;
  listing_address: string | null;
  listing_suburb: string | null;
};

export type ViewingAgentOption = { id: string; name: string };
export type ViewingListingOption = { id: string; address: string | null; suburb: string | null };

export type CompanyViewingsPageData = {
  clientId: string;
  clientName: string;
  rows: ViewingWorkspaceRow[];
  kpis: SalesKpiItem[];
  tabCounts: Record<ViewingCompanyTab, number>;
  agents: ViewingAgentOption[];
  listings: ViewingListingOption[];
};
