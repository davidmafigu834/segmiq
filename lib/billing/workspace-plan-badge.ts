export type WorkspacePlanBadge = { label: string; overdue: boolean };

export type WorkspacePlanInput = {
  plan: string | null;
  status: string | null;
  periodEnd: string | null;
  invoiceOverdue: boolean;
};

const PLAN_LABELS: Record<string, string> = {
  starter: "Starter",
  professional: "Growth",
  growth: "Growth",
  business: "Scale",
  scale: "Scale",
  crm_starter: "Starter",
  crm_growth: "Growth",
  agentic_business: "Business",
  agentic_scale: "Scale",
};

function titlePlan(plan: string) {
  return plan
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

/** Plan name while the subscription is current. Overdue when payment lapsed or the period ended. */
export function workspacePlanBadge(input: WorkspacePlanInput, now = Date.now()): WorkspacePlanBadge | null {
  const plan = input.plan?.trim().toLowerCase() || null;
  const status = input.status?.trim().toLowerCase() || null;
  if (!plan && !status && !input.invoiceOverdue) return null;

  const ended = input.periodEnd != null && input.periodEnd !== "" && Date.parse(input.periodEnd) < now;
  const paymentOverdue =
    input.invoiceOverdue || status === "past_due" || status === "suspended" || status === "overdue";
  const expired = status === "cancelled" || status === "expired" || ended;

  if (paymentOverdue || expired) return { label: "Overdue", overdue: true };
  if (!plan) return null;

  return { label: PLAN_LABELS[plan] ?? titlePlan(plan), overdue: false };
}
