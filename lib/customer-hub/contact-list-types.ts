export type ContactListActiveLead = {
  id: string;
  status: string;
  project_type: string | null;
  follow_up_date: string | null;
  assigneeName: string | null;
};

export type ContactListItem = {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  source: string | null;
  lifecycle: string;
  owner: string | null;
  lastTouchedAt: string | null;
  activeLead: ContactListActiveLead | null;
};

export type AttentionStatus = "follow_up_due" | "no_contact" | "quoted" | "won";

export type OverviewRecentContact = ContactListItem & {
  attentionStatus: AttentionStatus | null;
};
