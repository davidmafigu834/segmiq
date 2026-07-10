import type { LeadStatus } from "@/types";

/** Pipeline stages available when manually adding a lead to the Customer Hub. */
export const MANUAL_LEAD_STAGES: {
  value: LeadStatus;
  label: string;
  hint: string;
}[] = [
  { value: "NEW", label: "New", hint: "Fresh in the pipeline" },
  { value: "CONTACTED", label: "Contacted", hint: "You've already spoken" },
  { value: "NEGOTIATING", label: "Negotiating", hint: "Discussing terms or price" },
  { value: "PROPOSAL_SENT", label: "Proposal sent", hint: "Quote is out" },
  { value: "WON", label: "Won", hint: "Closed deal — also files as customer" },
  { value: "LOST", label: "Lost", hint: "Didn't convert" },
  { value: "NOT_QUALIFIED", label: "Not qualified", hint: "Not a fit" },
];
