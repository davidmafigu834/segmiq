import type { JourneyStep, JourneyTriggerType } from "./types";

export type PredefinedJourney = {
  template_key: string;
  name: string;
  description: string;
  trigger_type: JourneyTriggerType;
  trigger_config: Record<string, unknown>;
  steps: JourneyStep[];
};

export const PREDEFINED_JOURNEYS: PredefinedJourney[] = [
  {
    template_key: "quotation_recovery",
    name: "Quotation recovery",
    description:
      "Quotation sent but no customer response after 3 days — send a WhatsApp follow-up, wait 2 days, then notify the salesperson if still silent.",
    trigger_type: "quotation_no_response",
    trigger_config: { days_since_sent: 3 },
    steps: [
      { type: "send_whatsapp" },
      { type: "wait_days", config: { days: 2 } },
      { type: "check_still_eligible" },
      { type: "notify_assignee" },
      { type: "complete" },
    ],
  },
  {
    template_key: "dormant_reactivation",
    name: "Dormant lead reactivation",
    description:
      "Pipeline leads with no activity for 60 days receive a personalised reactivation message.",
    trigger_type: "dormant_lead",
    trigger_config: { inactive_days: 60 },
    steps: [{ type: "send_whatsapp" }, { type: "complete" }],
  },
  {
    template_key: "customer_anniversary",
    name: "Customer anniversary",
    description:
      "Customers whose last won deal was approximately 12 months ago receive an anniversary message with maintenance or referral offer.",
    trigger_type: "customer_anniversary",
    trigger_config: { months_since_won: 12, window_days: 14 },
    steps: [{ type: "send_whatsapp" }, { type: "complete" }],
  },
  {
    template_key: "lost_deal_recovery",
    name: "Lost deal recovery — waiting on funds",
    description:
      "Deals lost with reason related to funding, after 30 days — send updated payment-plan information.",
    trigger_type: "lost_deal_funds",
    trigger_config: { days_since_lost: 30 },
    steps: [
      { type: "wait_days", config: { days: 0 } },
      { type: "send_whatsapp" },
      { type: "complete" },
    ],
  },
];

export function getPredefinedJourney(templateKey: string): PredefinedJourney | undefined {
  return PREDEFINED_JOURNEYS.find((j) => j.template_key === templateKey);
}
