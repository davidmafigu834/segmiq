import { notFound } from "next/navigation";
import { AgencyLayout } from "@/components/layouts/AgencyLayout";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  InvoiceDetailClient,
  type InvoiceDetail,
  type PaymentRow,
} from "@/components/billing/InvoiceDetailClient";

export const dynamic = "force-dynamic";

export default async function InvoiceDetailPage({ params }: { params: { invoiceId: string } }) {
  const supabase = createAdminClient();

  const { data: invoice } = await supabase
    .from("invoices")
    .select(
      "id, subscription_id, client_id, invoice_number, amount, currency, status, period_start, period_end, issued_at, due_at, paid_at, pdf_url"
    )
    .eq("id", params.invoiceId)
    .maybeSingle();

  if (!invoice) notFound();

  const [{ data: sub }, { data: client }, { data: payments }] = await Promise.all([
    supabase.from("subscriptions").select("plan").eq("id", invoice.subscription_id).maybeSingle(),
    supabase.from("clients").select("name").eq("id", invoice.client_id).maybeSingle(),
    supabase
      .from("payments")
      .select("id, amount, currency, method, method_detail, reference, status, recorded_via, paid_at, rejected_reason, created_at")
      .eq("invoice_id", params.invoiceId)
      .order("created_at", { ascending: false }),
  ]);

  const paymentIds = (payments ?? []).map((p) => p.id as string);
  const proofsByPayment: Record<string, { url: string; name: string }[]> = {};
  const receiptsByPayment: Record<string, { number: string; pdfUrl: string | null }> = {};
  if (paymentIds.length) {
    const [{ data: proofs }, { data: receipts }] = await Promise.all([
      supabase
        .from("payment_proofs")
        .select("payment_id, file_url, file_name")
        .in("payment_id", paymentIds),
      supabase
        .from("receipts")
        .select("payment_id, receipt_number, pdf_url")
        .in("payment_id", paymentIds),
    ]);
    for (const pr of proofs ?? []) {
      const pid = pr.payment_id as string;
      (proofsByPayment[pid] ??= []).push({
        url: pr.file_url as string,
        name: (pr.file_name as string | null) ?? "Proof",
      });
    }
    for (const r of receipts ?? []) {
      receiptsByPayment[r.payment_id as string] = {
        number: r.receipt_number as string,
        pdfUrl: (r.pdf_url as string | null) ?? null,
      };
    }
  }

  const detail: InvoiceDetail = {
    id: invoice.id as string,
    subscriptionId: invoice.subscription_id as string,
    invoiceNumber: invoice.invoice_number as string,
    clientName: (client?.name as string | null) ?? "Unknown client",
    plan: (sub?.plan as string | null) ?? "starter",
    amount: Number(invoice.amount),
    currency: invoice.currency as string,
    status: invoice.status as string,
    periodStart: (invoice.period_start as string | null) ?? null,
    periodEnd: (invoice.period_end as string | null) ?? null,
    issuedAt: (invoice.issued_at as string | null) ?? null,
    dueAt: (invoice.due_at as string | null) ?? null,
    paidAt: (invoice.paid_at as string | null) ?? null,
    pdfUrl: (invoice.pdf_url as string | null) ?? null,
  };

  const paymentRows: PaymentRow[] = (payments ?? []).map((p) => ({
    id: p.id as string,
    amount: Number(p.amount),
    currency: p.currency as string,
    method: p.method as string,
    methodDetail: (p.method_detail as string | null) ?? null,
    reference: (p.reference as string | null) ?? null,
    status: p.status as string,
    recordedVia: p.recorded_via as string,
    paidAt: (p.paid_at as string | null) ?? null,
    rejectedReason: (p.rejected_reason as string | null) ?? null,
    proofs: proofsByPayment[p.id as string] ?? [],
    receipt: receiptsByPayment[p.id as string] ?? null,
  }));

  return (
    <AgencyLayout breadcrumb="AGENCY / BILLING / INVOICE" pageTitle={detail.invoiceNumber}>
      <InvoiceDetailClient detail={detail} payments={paymentRows} />
    </AgencyLayout>
  );
}
