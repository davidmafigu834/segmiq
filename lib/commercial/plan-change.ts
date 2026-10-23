import {
  createPricingSnapshot,
  type AgenticSku,
  type BillingPeriod,
  type Catalogue,
  type CrmSku,
  type PricingSnapshot,
} from "@/lib/commercial/catalogue";

export type ChargeHandling = "prorate" | "waive" | "at_renewal";
export type PlanChangePreview = {
  current: PricingSnapshot;
  proposed: PricingSnapshot;
  monthlyDifferenceUsdCents: number;
  oneTimeAdjustmentUsdCents: number;
  effectiveAt: string;
  chargeHandling: ChargeHandling;
  consentRequired: boolean;
};

export function previewPlanChange(
  catalogue: Catalogue,
  input: {
    current: PricingSnapshot;
    crmSku: CrmSku;
    aiSku?: AgenticSku | null;
    purchasedSeats: number;
    billingCycle: BillingPeriod;
    effectiveAt: Date;
    chargeHandling: ChargeHandling;
    periodStart?: Date | null;
    periodEnd?: Date | null;
    now?: Date;
  },
): PlanChangePreview {
  if (!Number.isFinite(input.effectiveAt.getTime()))
    throw new Error("A valid effective date is required");
  const proposed = createPricingSnapshot(catalogue, input);
  const monthlyDifferenceUsdCents =
    proposed.recurringMonthlyUsdCents - input.current.recurringMonthlyUsdCents;
  let oneTimeAdjustmentUsdCents = 0;
  if (input.chargeHandling === "prorate" && monthlyDifferenceUsdCents !== 0) {
    if (!input.periodStart || !input.periodEnd)
      throw new Error("Billing period dates are required for proration");
    const total = input.periodEnd.getTime() - input.periodStart.getTime();
    const remaining = Math.max(
      0,
      input.periodEnd.getTime() - (input.now ?? new Date()).getTime(),
    );
    if (total <= 0) throw new Error("Invalid billing period");
    oneTimeAdjustmentUsdCents = Math.round(
      monthlyDifferenceUsdCents * Math.min(1, remaining / total),
    );
  }
  return {
    current: input.current,
    proposed,
    monthlyDifferenceUsdCents,
    oneTimeAdjustmentUsdCents,
    effectiveAt: input.effectiveAt.toISOString(),
    chargeHandling: input.chargeHandling,
    consentRequired:
      monthlyDifferenceUsdCents > 0 || oneTimeAdjustmentUsdCents > 0,
  };
}

export function validateConsent(
  preview: PlanChangePreview,
  agreementRef: string | null | undefined,
): void {
  if (
    preview.consentRequired &&
    (!agreementRef || agreementRef.trim().length < 3)
  )
    throw new Error(
      "Customer consent evidence is required for charge-bearing terms",
    );
}
export function commercialWritesEnabled(): boolean {
  return process.env.PLATFORM_COMMERCIAL_WRITES_ENABLED === "true";
}

export function shouldApplyPlanChangeImmediately(input: {
  chargeHandling: ChargeHandling;
  effectiveAt: Date;
  now?: Date;
}): boolean {
  return (
    input.chargeHandling !== "at_renewal" &&
    input.effectiveAt.getTime() <= (input.now ?? new Date()).getTime()
  );
}
