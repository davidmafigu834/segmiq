import type { LeadStatus } from "@/types";

/** Lifecycle stages available when manually adding a lead to the Customer Hub. */
export const MANUAL_LEAD_STAGES: {
  value: LeadStatus;
  label: string;
  hint: string;
}[] = [
  { value: "NEW", label: "New", hint: "Fresh enquiry — not yet a deal" },
  { value: "CONTACTED", label: "Contacted", hint: "You've already spoken" },
  { value: "QUALIFIED", label: "Qualified", hint: "Real opportunity — ready to create a deal" },
  { value: "NOT_QUALIFIED", label: "Not qualified", hint: "No genuine deal to pursue" },
];
