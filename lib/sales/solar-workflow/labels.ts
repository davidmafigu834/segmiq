export const SOLAR_SALES_STAGE_LABEL: Record<import("./types").SolarSalesStage, string> = {
  NEW_LEAD: "New Lead",
  CONTACTED: "Contacted",
  QUALIFIED: "Qualified",
  SITE_VISIT_REQUIRED: "Site Visit Required",
  SITE_VISIT_COMPLETED: "Site Visit Completed",
  PROPOSAL_PREPARED: "Proposal Prepared",
  QUOTE_SENT: "Quote Sent",
  NEGOTIATION: "Negotiation",
  WON: "Won",
  LOST: "Lost",
};

export const SOLAR_PROGRESS_STEPS = [
  { id: "NEW_LEAD", label: "New Lead" },
  { id: "CONTACTED", label: "Contacted" },
  { id: "QUALIFIED", label: "Qualified" },
  { id: "SITE_VISIT", label: "Site Visit" },
  { id: "PROPOSAL", label: "Proposal" },
  { id: "NEGOTIATION", label: "Negotiation" },
  { id: "WON", label: "Won" },
] as const;

export function solarProgressIndex(stage: import("./types").SolarSalesStage): number {
  if (stage === "NEW_LEAD") return 0;
  if (stage === "CONTACTED") return 1;
  if (stage === "QUALIFIED") return 2;
  if (stage === "SITE_VISIT_REQUIRED" || stage === "SITE_VISIT_COMPLETED") return 3;
  if (stage === "PROPOSAL_PREPARED" || stage === "QUOTE_SENT") return 4;
  if (stage === "NEGOTIATION") return 5;
  if (stage === "WON") return 6;
  return -1;
}
