import { AgencyLayout } from "@/components/layouts/AgencyLayout";
import { createAdminClient } from "@/lib/supabase/admin";
import { SubscriptionsListClient, type SubscriptionRow } from "@/components/billing/SubscriptionsListClient";
import { SubscribePaidClientForm } from "@/components/billing/SubscribePaidClientForm";

export const dynamic = "force-dynamic";

const UNPAID_STATUSES = ["sent", "overdue"];

export default async function BillingPage() {
  const supabase = createAdminClient();

  const { data: allClients } = await supabase
    .from("clients")
    .select("id, name")
    .or("is_archived.is.null,is_archived.eq.false")
    .order("name");

  const clientOptions =
    allClients?.map((c) => ({ id: c.id as string, name: c.name as string })) ?? [];

  const { data: subs } = await supabase
    .from("subscriptions")
    .select("id, client_id, plan, billing_cycle, amount, currency, status, current_period_end")
    .order("created_at", { ascending: true });

  const subscriptions = subs ?? [];
  const clientIds = Array.from(new Set(subscriptions.map((s) => s.client_id as string)));

  const clientNames: Record<string, string> = {};
  if (clientIds.length) {
    const { data: clients } = await supabase.from("clients").select("id, name").in("id", clientIds);
    for (const c of clients ?? []) clientNames[c.id as string] = c.name as string;
  }

  // Outstanding balance per subscription = sum of unpaid (sent/overdue) invoices.
  const outstanding: Record<string, number> = {};
  const subIds = subscriptions.map((s) => s.id as string);
  if (subIds.length) {
    const { data: invoices } = await supabase
      .from("invoices")
      .select("subscription_id, amount, status")
      .in("subscription_id", subIds)
      .in("status", UNPAID_STATUSES);
    for (const inv of invoices ?? []) {
      const sid = inv.subscription_id as string;
      outstanding[sid] = (outstanding[sid] ?? 0) + Number(inv.amount);
    }
  }

  const rows: SubscriptionRow[] = subscriptions.map((s) => ({
    id: s.id as string,
    clientName: clientNames[s.client_id as string] ?? "Unknown client",
    plan: s.plan as string,
    billingCycle: s.billing_cycle as string,
    amount: Number(s.amount),
    currency: s.currency as string,
    status: s.status as string,
    currentPeriodEnd: (s.current_period_end as string | null) ?? null,
    outstanding: outstanding[s.id as string] ?? 0,
  }));

  return (
    <AgencyLayout breadcrumb="AGENCY / BILLING" pageTitle="Billing" titleSize="hero">
      <div className="space-y-6">
        <SubscribePaidClientForm clients={clientOptions} />
        <SubscriptionsListClient rows={rows} />
      </div>
    </AgencyLayout>
  );
}
