import "server-only";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertSnapshotMatchesCatalogue, createPricingSnapshot, type PricingSnapshot } from "@/lib/commercial/catalogue";
import { loadCanonicalCatalogue } from "@/lib/commercial/catalogue-repository";
import { previewPlanChange, type PlanChangePreview } from "@/lib/commercial/plan-change";
import { assertMigrationEffectiveNow } from "@/lib/commercial/migration";

export const planChangeInputSchema = z.object({
  crmSku: z.enum(["crm_starter", "crm_growth"]),
  aiSku: z.enum(["agentic_business", "agentic_scale"]).nullable().optional(),
  purchasedSeats: z.number().int().positive(),
  billingCycle: z.enum(["monthly", "annual"]),
  effectiveAt: z.string().datetime(),
  chargeHandling: z.enum(["prorate", "waive", "at_renewal"]),
  reason: z.string().trim().min(3).max(500),
  idempotencyKey: z.string().trim().min(8).max(200),
  agreementRef: z.string().trim().max(500).nullable().optional(),
});
export type PlanChangeInput = z.infer<typeof planChangeInputSchema>;

export async function buildPlanChangePreview(clientId: string, raw: unknown): Promise<{ input: PlanChangeInput; preview: PlanChangePreview }> {
  const input = planChangeInputSchema.parse(raw);
  const db = createAdminClient();
  const [{ data: account, error }, { data: subscription }] = await Promise.all([
    db.from("platform_commercial_accounts").select("agreed_price_snapshot, renewal_at").eq("client_id", clientId).maybeSingle(),
    db.from("subscriptions").select("current_period_start, current_period_end").eq("client_id", clientId).eq("product", "crm").order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (error) throw new Error(error.message);
  if (!account) throw new Error("Legacy — not migrated. Create an approved migration before changing this plan.");
  const catalogue = await loadCanonicalCatalogue({ forNewOffer: true });
  const current = account.agreed_price_snapshot as PricingSnapshot;
  assertSnapshotMatchesCatalogue(current, catalogue);
  const preview = previewPlanChange(catalogue, {
    current, crmSku: input.crmSku, aiSku: input.aiSku, purchasedSeats: input.purchasedSeats,
    billingCycle: input.billingCycle, effectiveAt: new Date(input.effectiveAt), chargeHandling: input.chargeHandling,
    periodStart: subscription?.current_period_start ? new Date(subscription.current_period_start as string) : null,
    periodEnd: subscription?.current_period_end ? new Date(subscription.current_period_end as string) : null,
  });
  return { input, preview };
}

export async function buildMigrationPreview(clientId: string, raw: unknown, options: { requireEffectiveNow?: boolean; now?: Date } = {}) {
  const input = planChangeInputSchema.parse(raw);
  if (options.requireEffectiveNow)
    assertMigrationEffectiveNow(new Date(input.effectiveAt), options.now);
  const db = createAdminClient();
  const [{ data: existing }, { data: subscription, error }] = await Promise.all([
    db.from("platform_commercial_accounts").select("client_id").eq("client_id", clientId).maybeSingle(),
    db.from("subscriptions").select("id, plan, amount, currency, status, current_period_end").eq("client_id", clientId).eq("product", "crm").order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (error) throw new Error(error.message);
  if (existing) throw new Error("This organisation already has a commercial account");
  if (!subscription) throw new Error("A legacy CRM subscription is required for controlled migration");
  const catalogue = await loadCanonicalCatalogue({ forNewOffer: true });
  const proposed = createPricingSnapshot(catalogue, input);
  return { input, proposed, legacy: { subscriptionId: String(subscription.id), plan: String(subscription.plan), amount: Number(subscription.amount), currency: String(subscription.currency), status: String(subscription.status), renewalAt: subscription.current_period_end ? String(subscription.current_period_end) : null } };
}
