import { Preferences } from "@capacitor/preferences";
import { apiGet } from "./api";
import type { DashboardData, LeadRow } from "./types";

const LEADS_CACHE_KEY = "segmiq_sales_leads_cache";
const DASHBOARD_CACHE_KEY = "segmiq_sales_dashboard_cache";

export async function fetchDashboard(): Promise<DashboardData> {
  const res = await apiGet<DashboardData | { error?: string }>("/api/sales/dashboard");
  if (!res.ok) {
    const cached = await getCachedDashboard();
    if (cached) return cached;
    throw new Error((res.data as { error?: string }).error ?? "Failed to load dashboard");
  }
  await Preferences.set({ key: DASHBOARD_CACHE_KEY, value: JSON.stringify(res.data) });
  return res.data as DashboardData;
}

export async function getCachedDashboard(): Promise<DashboardData | null> {
  const { value } = await Preferences.get({ key: DASHBOARD_CACHE_KEY });
  if (!value) return null;
  try {
    return JSON.parse(value) as DashboardData;
  } catch {
    return null;
  }
}

export async function fetchLeads(): Promise<LeadRow[]> {
  const res = await apiGet<{ leads?: LeadRow[]; error?: string }>("/api/sales/app/leads");
  if (!res.ok) {
    const cached = await getCachedLeads();
    if (cached) return cached;
    throw new Error(res.data.error ?? "Failed to load leads");
  }
  const leads = res.data.leads ?? [];
  await Preferences.set({ key: LEADS_CACHE_KEY, value: JSON.stringify(leads) });
  return leads;
}

export async function getCachedLeads(): Promise<LeadRow[] | null> {
  const { value } = await Preferences.get({ key: LEADS_CACHE_KEY });
  if (!value) return null;
  try {
    return JSON.parse(value) as LeadRow[];
  } catch {
    return null;
  }
}

export async function fetchLead(leadId: string): Promise<LeadRow> {
  const res = await apiGet<{ lead?: LeadRow; error?: string }>(`/api/leads/${leadId}`);
  if (!res.ok || !res.data.lead) {
    throw new Error(res.data.error ?? "Lead not found");
  }
  return res.data.lead;
}
