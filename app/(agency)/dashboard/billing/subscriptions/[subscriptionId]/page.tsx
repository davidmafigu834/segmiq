import { notFound } from "next/navigation";
import { AgencyLayout } from "@/components/layouts/AgencyLayout";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  SubscriptionDetailClient,
  type SubscriptionDetail,
  type InvoiceHistoryRow,
} from "@/components/billing/SubscriptionDetailClient";

export const dynamic = "force-dynamic";

export default async function SubscriptionDetailPage({
  params,
}: {
  params: { subscriptionId: string };
}) {
  const supabase = createAdminClient();

  const { data: sub } = await supabase
    .from("subscriptions")
    .select(
      "id, client_id, plan, billing_cycle, amount, currency, status, current_period_start, current_period_end, grace_days, started_at, cancelled_at"
    )
    .eq("id", params.subscriptionId)
    .maybeSingle();

  if (!sub) notFound();

  const { data: client } = await supabase
    .from("clients")
    .select("name")
    .eq("id", sub.client_id)
    .maybeSingle();

  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, invoice_number, amount, currency, status, issued_at, due_at, pdf_url")
    .eq("subscription_id", params.subscriptionId)
    .order("created_at", { ascending: false });

  const detail: SubscriptionDetail = {
    id: sub.id as string,
    clientName: (client?.name as string | null) ?? "Unknown client",
    plan: sub.plan as string,
    billingCycle: sub.billing_cycle as string,
    amount: Number(sub.amount),
    currency: sub.currency as string,
    status: sub.status as string,
    currentPeriodStart: (sub.current_period_start as string | null) ?? null,
    currentPeriodEnd: (sub.current_period_end as string | null) ?? null,
    graceDays: Number(sub.grace_days),
    startedAt: (sub.started_at as string | null) ?? null,
    cancelledAt: (sub.cancelled_at as string | null) ?? null,
  };

  const history: InvoiceHistoryRow[] = (invoices ?? []).map((i) => ({
    id: i.id as string,
    invoiceNumber: i.invoice_number as string,
    amount: Number(i.amount),
    currency: i.currency as string,
    status: i.status as string,
    issuedAt: (i.issued_at as string | null) ?? null,
    dueAt: (i.due_at as string | null) ?? null,
    pdfUrl: (i.pdf_url as string | null) ?? null,
  }));

  return (
    <AgencyLayout breadcrumb="PLATFORM / BILLING / SUBSCRIPTION" pageTitle={detail.clientName}>
      <SubscriptionDetailClient detail={detail} history={history} />
    </AgencyLayout>
  );
}
