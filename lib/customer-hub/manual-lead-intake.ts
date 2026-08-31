import type { LeadStatus } from "@/types";

/** Lead lifecycle stages available when manually adding a lead to the Customer Hub. */
export const MANUAL_LEAD_STAGES: {
  value: LeadStatus;
  label: string;
  hint: string;
}[] = [
  { value: "NEW", label: "New", hint: "Fresh enquiry — not yet a deal" },
  { value: "CONTACTED", label: "Contacted", hint: "You've already spoken" },
  { value: "QUALIFIED", label: "Qualified", hint: "Real opportunity — ready to create a deal" },
  {
    value: "NOT_QUALIFIED",
    label: "Not qualified",
    hint: "Closes the lead — only use if there is no deal to pursue",
  },
];

export type ManualLeadPriority = "hot" | "warm" | "cold";

export function normalizeManualLeadPriority(
  value: unknown
): ManualLeadPriority | undefined {
  if (value === "hot" || value === "warm" || value === "cold") return value;
  return undefined;
}

/** Map rep-selected urgency to a score so Hot/Warm/Cold displays stay consistent. */
export function scoreFromManualPriority(
  priority: ManualLeadPriority | undefined
): number | undefined {
  if (priority === "hot") return 75;
  if (priority === "warm") return 55;
  if (priority === "cold") return 30;
  return undefined;
}

export const MANUAL_LEAD_INITIAL_STATUSES = [
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "CONVERTED_TO_DEAL",
  "NOT_QUALIFIED",
  "NEGOTIATING",
  "PROPOSAL_SENT",
  "WON",
  "LOST",
] as const satisfies readonly LeadStatus[];

export type ManualLeadInitialStatus = (typeof MANUAL_LEAD_INITIAL_STATUSES)[number];
