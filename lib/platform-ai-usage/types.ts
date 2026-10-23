export type AiUsageMode = "shadow" | "financial";
export type AiUsageType = "customer_conversation" | "internal_ai_action";

export type AiQuotaMetric = {
  included: number;
  topups: number;
  consumed: number;
  available: number;
  percent: number;
  threshold: 0 | 80 | 95 | 100;
};

export type AiUsageOverview = {
  clientId: string;
  companyName: string;
  status:
    | "shadow"
    | "enforced"
    | "unmetered_legacy"
    | "suspended"
    | "no_signed_agreement";
  aiSku: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  conversations: AiQuotaMetric | null;
  actions: AiQuotaMetric | null;
  lastMeasuredAt: string | null;
};

export type ConversationObservation = {
  clientId: string;
  sourceEventKey: string;
  channel: "whatsapp";
  subjectKey: string;
  occurredAt: string;
  successful: boolean;
  testMode: boolean;
};
