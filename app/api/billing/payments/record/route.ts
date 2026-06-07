import { NextResponse } from "next/server";
import { requireAgencyAdmin } from "@/lib/require-agency-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { putObject, getPublicUrl } from "@/lib/storage/r2";
import { applyPayment } from "@/lib/billing/payments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const METHODS = ["bank_transfer", "mobile_money", "cash", "other"];

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "proof";
}

/**
 * Agency records a payment it has already verified — stored as `confirmed`
 * directly (recorded_via = 'agency_manual'). Then applyPayment settles the
 * invoice + advances the subscription if the invoice is now fully covered.
 */
export async function POST(req: Request) {
  const guard = await requireAgencyAdmin();
  if ("error" in guard) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  const userId = guard.session.userId;

  const form = await req.formData();
  const invoiceId = String(form.get("invoiceId") ?? "");
  const amount = Number(form.get("amount"));
  const method = String(form.get("method") ?? "");
  const methodDetail = (form.get("method_detail") as string | null)?.trim() || null;
  const reference = (form.get("reference") as string | null)?.trim() || null;
  const paidAtRaw = (form.get("paid_at") as string | null)?.trim() || null;
  const file = form.get("proof");

  if (!invoiceId) {
    return NextResponse.json({ error: "invoiceId is required" }, { status: 400 });
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
  }
  if (!METHODS.includes(method)) {
    return NextResponse.json({ error: "Invalid method" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: invoice, error: invErr } = await supabase
    .from("invoices")
    .select("id, client_id, currency, status")
    .eq("id", invoiceId)
    .single();
  if (invErr || !invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }
  if (invoice.status === "void") {
    return NextResponse.json({ error: "Cannot record payment on a void invoice" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const paidAt = paidAtRaw ? new Date(paidAtRaw).toISOString() : now;

  const { data: payment, error: payErr } = await supabase
    .from("payments")
    .insert({
      invoice_id: invoiceId,
      client_id: invoice.client_id,
      amount,
      currency: invoice.currency,
      method,
      method_detail: methodDetail,
      reference,
      status: "confirmed",
      recorded_via: "agency_manual",
      recorded_by: userId,
      confirmed_by: userId,
      confirmed_at: now,
      paid_at: paidAt,
    })
    .select("id")
    .single();
  if (payErr || !payment) {
    return NextResponse.json({ error: payErr?.message ?? "Failed to record payment" }, { status: 500 });
  }

  const paymentId = payment.id as string;

  if (file instanceof File && file.size > 0) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const key = `billing/proofs/${paymentId}/${sanitizeFileName(file.name)}`;
    await putObject(key, buffer, file.type || "application/octet-stream");
    await supabase.from("payment_proofs").insert({
      payment_id: paymentId,
      file_url: getPublicUrl(key),
      file_name: file.name,
      file_type: file.type || null,
      uploaded_by: userId,
    });
  }

  const result = await applyPayment(paymentId);
  return NextResponse.json({ ok: true, paymentId, ...result }, { status: 201 });
}
