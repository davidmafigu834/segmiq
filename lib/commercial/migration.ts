import {
  createPricingSnapshot,
  type Catalogue,
  type CrmSku,
  type PricingSnapshot,
} from "@/lib/commercial/catalogue";

export type LegacyMigrationSource = {
  clientId: string;
  clientName: string;
  subscriptionId: string;
  legacyPlan: string;
  amount: number;
  currency: string;
  billingCycle: "monthly" | "annual";
  status: string;
  currentPeriodEnd: string | null;
  activeUsers: number;
};

export type MigrationCandidate = LegacyMigrationSource & {
  currentMonthlyUsdCents: number | null;
  proposedCrmSku: CrmSku;
  proposed: PricingSnapshot;
  proposedEffectiveAt: string;
  contractRequirement: "SIGNED_AMENDMENT_REQUIRED";
};

export function buildMigrationCandidate(
  catalogue: Catalogue,
  source: LegacyMigrationSource,
  now = new Date(),
): MigrationCandidate {
  const proposedCrmSku: CrmSku =
    source.legacyPlan.toLowerCase() === "starter"
      ? "crm_starter"
      : "crm_growth";
  const proposed = createPricingSnapshot(catalogue, {
    crmSku: proposedCrmSku,
    aiSku: null,
    purchasedSeats: Math.max(1, source.activeUsers),
    billingCycle: source.billingCycle,
  });
  const amountCents = Number.isFinite(source.amount)
    ? Math.round(source.amount * 100)
    : null;
  const currentMonthlyUsdCents =
    source.currency === "USD" && amountCents !== null
      ? source.billingCycle === "annual"
        ? Math.round(amountCents / 12)
        : amountCents
      : null;
  const periodEnd = source.currentPeriodEnd
    ? new Date(source.currentPeriodEnd)
    : null;
  const proposedEffectiveAt =
    periodEnd && !Number.isNaN(periodEnd.getTime()) && periodEnd > now
      ? periodEnd.toISOString()
      : now.toISOString();

  return {
    ...source,
    currentMonthlyUsdCents,
    proposedCrmSku,
    proposed,
    proposedEffectiveAt,
    contractRequirement: "SIGNED_AMENDMENT_REQUIRED",
  };
}

/** A migration may be previewed early, but can only be committed at its effective time. */
export function assertMigrationEffectiveNow(
  effectiveAt: Date,
  now = new Date(),
  clockSkewMs = 5 * 60 * 1000,
): void {
  if (Number.isNaN(effectiveAt.getTime())) throw new Error("Invalid effective date");
  if (effectiveAt.getTime() < now.getTime() - clockSkewMs)
    throw new Error("Migration effective date cannot be backdated");
  if (effectiveAt.getTime() > now.getTime() + clockSkewMs)
    throw new Error("Migration can only be confirmed when its effective time arrives");
}
