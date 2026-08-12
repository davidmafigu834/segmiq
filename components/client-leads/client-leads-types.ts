import type { LeadRow, LeadSource, LeadStatus } from "@/types";

export type ClientLeadListRow = LeadRow & {
  last_call_at: string | null;
  assigned_to: { id: string; name: string; avatar_url: string | null } | { id: string; name: string; avatar_url: string | null }[] | null;
};

export const ALL_STATUSES: LeadStatus[] = [
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "CONVERTED_TO_DEAL",
  "NOT_QUALIFIED",
  "NEGOTIATING",
  "PROPOSAL_SENT",
  "WON",
  "LOST",
];

export function unwrapAssignee(
  raw: ClientLeadListRow["assigned_to"]
): { id: string; name: string; avatar_url: string | null } | null {
  if (!raw) return null;
  if (Array.isArray(raw)) return raw[0] ?? null;
  return raw;
}

export function statusLabel(s: LeadStatus): string {
  if (s === "CONVERTED_TO_DEAL") return "Deal created";
  if (s === "NOT_QUALIFIED") return "Not qualified";
  if (s === "PROPOSAL_SENT") return "Proposal sent";
  return s.replace(/_/g, " ");
}

export function sourceLabel(s: LeadSource): string {
  if (s === "FACEBOOK") return "Facebook";
  if (s === "LANDING_PAGE") return "Landing page";
  if (s === "REFERRAL") return "Referral";
  if (s === "WHATSAPP_INBOUND") return "WhatsApp";
  return "Manual";
}
