import { AgencyLayout } from "@/components/layouts/AgencyLayout";
import { createAdminClient } from "@/lib/supabase/admin";
import { PendingPaymentsClient, type PendingPayment } from "@/components/billing/PendingPaymentsClient";

export const dynamic = "force-dynamic";

export default async function PendingPaymentsPage() {
  const supabase = createAdminClient();

  const { data: payments } = await supabase
    .from("payments")
    .select("id, invoice_id, client_id, amount, currency, method, method_detail, reference, paid_at, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  const list = payments ?? [];
  const invoiceIds = Array.from(new Set(list.map((p) => p.invoice_id as string)));
  const clientIds = Array.from(new Set(list.map((p) => p.client_id as string)));
  const paymentIds = list.map((p) => p.id as string);

  const invoiceNumbers: Record<string, string> = {};
  if (invoiceIds.length) {
    const { data: invoices } = await supabase
      .from("invoices")
      .select("id, invoice_number")
      .in("id", invoiceIds);
    for (const i of invoices ?? []) invoiceNumbers[i.id as string] = i.invoice_number as string;
  }

  const clientNames: Record<string, string> = {};
  if (clientIds.length) {
    const { data: clients } = await supabase.from("clients").select("id, name").in("id", clientIds);
    for (const c of clients ?? []) clientNames[c.id as string] = c.name as string;
  }

  const proofsByPayment: Record<string, { url: string; name: string }[]> = {};
  if (paymentIds.length) {
    const { data: proofs } = await supabase
      .from("payment_proofs")
      .select("payment_id, file_url, file_name")
      .in("payment_id", paymentIds);
    for (const pr of proofs ?? []) {
      const pid = pr.payment_id as string;
      (proofsByPayment[pid] ??= []).push({
        url: pr.file_url as string,
        name: (pr.file_name as string | null) ?? "Proof",
      });
    }
  }

  const rows: PendingPayment[] = list.map((p) => ({
    id: p.id as string,
    invoiceId: p.invoice_id as string,
    invoiceNumber: invoiceNumbers[p.invoice_id as string] ?? "—",
    clientName: clientNames[p.client_id as string] ?? "Unknown client",
    amount: Number(p.amount),
    currency: p.currency as string,
    method: p.method as string,
    methodDetail: (p.method_detail as string | null) ?? null,
    reference: (p.reference as string | null) ?? null,
    paidAt: (p.paid_at as string | null) ?? null,
    proofs: proofsByPayment[p.id as string] ?? [],
  }));

  return (
    <AgencyLayout breadcrumb="PLATFORM / BILLING / PAYMENTS" pageTitle="Pending payments" titleSize="hero">
      <PendingPaymentsClient rows={rows} />
    </AgencyLayout>
  );
}
