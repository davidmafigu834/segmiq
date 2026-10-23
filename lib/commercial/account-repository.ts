import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { countPaidSeats, type PricingSnapshot } from "@/lib/commercial/catalogue";

export type CommercialOverview = {
  legacy: boolean;
  occupiedSeats: number;
  account: null | { crmSku: string; aiSku: string | null; priceVersion: string; purchasedSeats: number; occupiedSeats: number; status: string; billingCycle: string; renewalAt: string | null; agreedPriceSnapshot: PricingSnapshot; agreementRef: string | null };
  legacySubscription: null | { id: string; plan: string; amount: number; currency: string; status: string; billingCycle: string; currentPeriodEnd: string | null };
  invoices: Array<{ id: string; invoiceNumber: string; amount: number; currency: string; status: string; issuedAt: string | null; dueAt: string | null }>;
  activeGrace: null | { id: string; startsAt: string; endsAt: string; reason: string };
  recentChanges: Array<{ id: string; status: string; effectiveAt: string; chargeHandling: string; reason: string; createdAt: string }>;
  recentAudit: Array<{ id: number; eventType: string; recordedAt: string; details: Record<string, unknown> }>;
};

export async function loadCommercialOverview(clientId: string, now = new Date()): Promise<CommercialOverview> {
  const db = createAdminClient();
  const [accountResult, subscriptionResult, usersResult, graceResult, changesResult, auditResult, invoicesResult] = await Promise.all([
    db.from("platform_commercial_accounts").select("client_id, crm_sku, ai_sku, price_version, purchased_seats, status, billing_cycle, renewal_at, agreed_price_snapshot, agreement_ref, legacy_subscription_id").eq("client_id", clientId).maybeSingle(),
    db.from("subscriptions").select("id, plan, amount, currency, status, billing_cycle, current_period_end").eq("client_id", clientId).eq("product", "crm").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("users").select("id, role, is_active").eq("client_id", clientId),
    db.from("platform_grace_periods").select("id, starts_at, ends_at, reason").eq("client_id", clientId).is("ended_at", null).lte("starts_at", now.toISOString()).gt("ends_at", now.toISOString()).order("ends_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("platform_plan_change_requests").select("id, status, effective_at, charge_handling, reason, created_at").eq("client_id", clientId).order("created_at", { ascending: false }).limit(5),
    db.from("platform_commercial_audit_events").select("id, event_type, recorded_at, details").eq("client_id", clientId).order("recorded_at", { ascending: false }).limit(10),
    db.from("invoices").select("id, invoice_number, amount, currency, status, issued_at, due_at").eq("client_id", clientId).order("issued_at", { ascending: false }).limit(10),
  ]);
  for (const result of [accountResult, subscriptionResult, usersResult, graceResult, changesResult, auditResult, invoicesResult]) {
    if (result.error) throw new Error(`Commercial overview unavailable: ${result.error.message}`);
  }
  const account = accountResult.data as Record<string, unknown> | null;
  const sub = subscriptionResult.data as Record<string, unknown> | null;
  const occupiedSeats = countPaidSeats(((usersResult.data ?? []) as Array<Record<string, unknown>>).map((u) => ({ userId: String(u.id), active: Boolean(u.is_active), role: String(u.role) })));
  return {
    legacy: !account,
    occupiedSeats,
    account: account ? { crmSku: String(account.crm_sku), aiSku: account.ai_sku ? String(account.ai_sku) : null, priceVersion: String(account.price_version), purchasedSeats: Number(account.purchased_seats), occupiedSeats, status: String(account.status), billingCycle: String(account.billing_cycle), renewalAt: account.renewal_at ? String(account.renewal_at) : null, agreedPriceSnapshot: account.agreed_price_snapshot as PricingSnapshot, agreementRef: account.agreement_ref ? String(account.agreement_ref) : null } : null,
    legacySubscription: sub ? { id: String(sub.id), plan: String(sub.plan), amount: Number(sub.amount), currency: String(sub.currency), status: String(sub.status), billingCycle: String(sub.billing_cycle), currentPeriodEnd: sub.current_period_end ? String(sub.current_period_end) : null } : null,
    invoices: ((invoicesResult.data ?? []) as Array<Record<string, unknown>>).map((r) => ({ id: String(r.id), invoiceNumber: String(r.invoice_number), amount: Number(r.amount), currency: String(r.currency), status: String(r.status), issuedAt: r.issued_at ? String(r.issued_at) : null, dueAt: r.due_at ? String(r.due_at) : null })),
    activeGrace: graceResult.data ? { id: String(graceResult.data.id), startsAt: String(graceResult.data.starts_at), endsAt: String(graceResult.data.ends_at), reason: String(graceResult.data.reason) } : null,
    recentChanges: ((changesResult.data ?? []) as Array<Record<string, unknown>>).map((r) => ({ id: String(r.id), status: String(r.status), effectiveAt: String(r.effective_at), chargeHandling: String(r.charge_handling), reason: String(r.reason), createdAt: String(r.created_at) })),
    recentAudit: ((auditResult.data ?? []) as Array<Record<string, unknown>>).map((r) => ({ id: Number(r.id), eventType: String(r.event_type), recordedAt: String(r.recorded_at), details: (r.details ?? {}) as Record<string, unknown> })),
  };
}
