import { NextResponse } from "next/server";
import { requireAgencyAdmin } from "@/lib/require-agency-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/resend";
import { paymentRejectedEmail } from "@/lib/email/templates/payment-rejected";
import { getClientNotificationEmails } from "@/lib/billing/recipients";
import { getPublicBaseUrl } from "@/lib/constants";
import { formatMoney } from "@/lib/billing/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireAgencyAdmin();
  if ("error" in guard) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  let body: { reason?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (!reason) {
    return NextResponse.json({ error: "A rejection reason is required" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: payment } = await supabase
    .from("payments")
    .select("id, status, client_id, invoice_id, amount, currency")
    .eq("id", params.id)
    .maybeSingle();
  if (!payment) {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  }
  if (payment.status === "confirmed") {
    return NextResponse.json({ error: "Payment was already confirmed" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("payments")
    .update({ status: "rejected", rejected_reason: reason, updated_at: now })
    .eq("id", params.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Email the client (WhatsApp is wired in a later prompt).
  const [{ data: invoice }, { data: client }, recipients] = await Promise.all([
    supabase.from("invoices").select("invoice_number").eq("id", payment.invoice_id).maybeSingle(),
    supabase.from("clients").select("name").eq("id", payment.client_id).maybeSingle(),
    getClientNotificationEmails(payment.client_id as string),
  ]);

  let emailed = false;
  if (recipients.length > 0) {
    const { subject, html } = paymentRejectedEmail({
      clientName: (client?.name as string | null) ?? "there",
      invoiceNumber: (invoice?.invoice_number as string | null) ?? "—",
      amountFormatted: formatMoney(payment.amount as number, payment.currency as string),
      reason,
      billingUrl: `${getPublicBaseUrl()}/client/billing`,
    });
    const result = await sendEmail({ to: recipients, subject, html });
    emailed = result.success;
  }

  return NextResponse.json({ ok: true, emailed });
}
