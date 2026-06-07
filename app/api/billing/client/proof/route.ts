import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { putObject, getPublicUrl } from "@/lib/storage/r2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const METHODS = ["bank_transfer", "mobile_money", "cash", "other"];

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "proof";
}

/**
 * Client Manager submits proof of a payment they have made. This creates a
 * PENDING payment (recorded_via = 'client_upload', recorded_by = null) plus a
 * payment_proofs row — it feeds the agency review queue and is NOT applied until
 * the agency confirms it.
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.userId || session.role !== "CLIENT_MANAGER" || !session.clientId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const clientId = session.clientId;

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
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "A proof file is required" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: invoice } = await supabase
    .from("invoices")
    .select("id, client_id, currency, status")
    .eq("id", invoiceId)
    .maybeSingle();
  if (!invoice || invoice.client_id !== clientId) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }
  if (invoice.status === "void" || invoice.status === "paid") {
    return NextResponse.json({ error: "This invoice is not awaiting payment" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const paidAt = paidAtRaw ? new Date(paidAtRaw).toISOString() : now;

  const { data: payment, error: payErr } = await supabase
    .from("payments")
    .insert({
      invoice_id: invoiceId,
      client_id: clientId,
      amount,
      currency: invoice.currency,
      method,
      method_detail: methodDetail,
      reference,
      status: "pending",
      recorded_via: "client_upload",
      recorded_by: null,
      paid_at: paidAt,
    })
    .select("id")
    .single();
  if (payErr || !payment) {
    return NextResponse.json({ error: payErr?.message ?? "Failed to submit payment" }, { status: 500 });
  }

  const paymentId = payment.id as string;
  const buffer = Buffer.from(await file.arrayBuffer());
  const key = `billing/proofs/${paymentId}/${sanitizeFileName(file.name)}`;
  await putObject(key, buffer, file.type || "application/octet-stream");
  await supabase.from("payment_proofs").insert({
    payment_id: paymentId,
    file_url: getPublicUrl(key),
    file_name: file.name,
    file_type: file.type || null,
    uploaded_by: session.userId,
  });

  return NextResponse.json({ ok: true, paymentId }, { status: 201 });
}
