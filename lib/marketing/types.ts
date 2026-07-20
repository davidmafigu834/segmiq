export type ConsentStatus = "opted_in" | "opted_out" | "unknown";

export type CampaignObjective =
  | "generate_sales"
  | "reactivate_leads"
  | "promote_offer"
  | "upsell_customers"
  | "request_referrals"
  | "announce_product"
  | "invite_event"
  | "follow_up_quotations";

export type CampaignStatus =
  | "draft"
  | "pending_approval"
  | "scheduled"
  | "sending"
  | "completed"
  | "paused"
  | "cancelled";

export type RecipientStatus =
  | "pending"
  | "sent"
  | "delivered"
  | "read"
  | "failed"
  | "skipped";

export type ResponseClassification =
  | "interested"
  | "later"
  | "not_interested"
  | "opt_out";

export type CampaignStats = {
  total: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  skipped: number;
  replied: number;
  opt_out: number;
};

export type AudiencePreview = {
  total: number;
  whatsappEligible: number;
  optedIn: number;
  optedOut: number;
  unknownConsent: number;
  suppressed: number;
  noPhone: number;
};

export type MarketingRecipient = {
  contactId: string;
  leadId: string | null;
  phone: string;
  name: string | null;
  consentStatus: ConsentStatus;
};

export const CAMPAIGN_OBJECTIVES: { id: CampaignObjective; label: string; description: string }[] = [
  { id: "generate_sales", label: "Generate sales", description: "Reach qualified leads with a compelling offer" },
  { id: "reactivate_leads", label: "Reactivate leads", description: "Re-engage dormant or cold contacts" },
  { id: "promote_offer", label: "Promote an offer", description: "Share a limited-time promotion or discount" },
  { id: "upsell_customers", label: "Upsell existing customers", description: "Offer complementary products to buyers" },
  { id: "request_referrals", label: "Request referrals", description: "Ask happy customers to refer others" },
  { id: "announce_product", label: "Announce a new product", description: "Launch a new service or product line" },
  { id: "invite_event", label: "Invite to an event", description: "Promote webinars, open days, or launches" },
  { id: "follow_up_quotations", label: "Follow up quotations", description: "Nudge prospects who received a quote" },
];

export const EMPTY_CAMPAIGN_STATS: CampaignStats = {
  total: 0,
  sent: 0,
  delivered: 0,
  read: 0,
  failed: 0,
  skipped: 0,
  replied: 0,
  opt_out: 0,
};
