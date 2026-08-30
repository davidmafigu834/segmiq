export const COMPLAINT_CATEGORIES = ["service", "listing", "agent", "transaction", "other"] as const;
export const COMPLAINT_STATUSES = ["open", "investigating", "resolved", "dismissed"] as const;
export const COMPLAINT_PRIORITIES = ["low", "medium", "high"] as const;

export type ComplaintCategory = (typeof COMPLAINT_CATEGORIES)[number];
export type ComplaintStatus = (typeof COMPLAINT_STATUSES)[number];
export type ComplaintPriority = (typeof COMPLAINT_PRIORITIES)[number];

export const COMPLAINT_CATEGORY_LABEL: Record<ComplaintCategory, string> = {
  service: "Service",
  listing: "Listing",
  agent: "Agent",
  transaction: "Transaction",
  other: "Other",
};

export const COMPLAINT_STATUS_LABEL: Record<ComplaintStatus, string> = {
  open: "Open",
  investigating: "Investigating",
  resolved: "Resolved",
  dismissed: "Dismissed",
};
