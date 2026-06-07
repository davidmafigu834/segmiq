/**
 * CRM plan pricing — the single source of truth for default subscription amounts.
 *
 * Prices are monthly USD. Annual billing is monthly × 10 (two months free).
 * This constant only sets the *default* amount when a subscription is created;
 * after creation, `subscriptions.amount` is authoritative (it is snapshotted, so
 * price changes here never retroactively alter existing subscriptions).
 */

export const CRM_PLAN_MONTHLY_USD = {
  starter: 99,
  growth: 199,
  scale: 349,
} as const;

export type CrmPlan = keyof typeof CRM_PLAN_MONTHLY_USD;
export type BillingCycle = "monthly" | "annual";

export const CRM_PLAN_LABELS: Record<CrmPlan, string> = {
  starter: "Starter",
  growth: "Growth",
  scale: "Scale",
};

/** Months charged up-front for a given cycle (annual = 10 → two months free). */
const CYCLE_MONTHS: Record<BillingCycle, number> = {
  monthly: 1,
  annual: 10,
};

/** Default invoice amount for a plan + billing cycle, in whole USD. */
export function getPlanAmount(plan: CrmPlan, cycle: BillingCycle): number {
  return CRM_PLAN_MONTHLY_USD[plan] * CYCLE_MONTHS[cycle];
}

/**
 * Map the legacy `clients.plan` value (starter/professional/business) onto the
 * billing plan vocabulary (starter/growth/scale). Anything unrecognised falls
 * back to `starter` — matching the backfill in migration 038.
 */
/** Compute period end from a start date and billing cycle. */
export function periodEndFromStart(start: Date, cycle: BillingCycle): Date {
  const end = new Date(start);
  if (cycle === "annual") {
    end.setFullYear(end.getFullYear() + 1);
  } else {
    end.setMonth(end.getMonth() + 1);
  }
  return end;
}

export function mapClientPlanToCrmPlan(clientPlan: string | null | undefined): CrmPlan {
  switch (clientPlan) {
    case "professional":
      return "growth";
    case "business":
      return "scale";
    case "starter":
      return "starter";
    default:
      return "starter";
  }
}
