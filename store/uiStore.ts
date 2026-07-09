import { create } from "zustand";

export type LeadPanelTab = "details" | "timeline" | "quote" | "send";

type LeadPanel = { open: boolean; leadId: string | null; tab: LeadPanelTab | null };

export const useLeadPanel = create<LeadPanel>(() => ({
  open: false,
  leadId: null,
  tab: null,
}));

export function openLeadPanel(leadId: string, tab?: LeadPanelTab) {
  useLeadPanel.setState({ open: true, leadId, tab: tab ?? null });
}

export function closeLeadPanel() {
  useLeadPanel.setState({ open: false, leadId: null, tab: null });
}
