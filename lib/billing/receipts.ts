import { createAdminClient } from "@/lib/supabase/admin";
import { putObject, getPublicUrl } from "@/lib/storage/r2";
import { renderReceiptPdf } from "@/lib/billing/receipt-pdf";
import { methodLabel } from "@/lib/billing/format";

export type GenerateReceiptResult = {
  receiptId: string;
  receiptNumber: string;
  alreadyExisted: boolean;
  pdfUrl: string | null;
};

/**
 * Generate a receipt for a confirmed payment. Idempotent per payment_id — if a
 * receipt already exists, returns it without creating a second or re-uploading.
 */
export async function generateReceipt(paymentId: string): Promise<GenerateReceiptResult> {
  const supabase = createAdminClient();

  const { data: payment } = await supabase
    .from("payments")
    .select("id, status")
    .eq("id", paymentId)
    .maybeSingle();
  if (!payment) {
    throw new Error(`Payment not found: ${paymentId}`);
  }
  if (payment.status !== "confirmed") {
    throw new Error(`Payment ${paymentId} is not confirmed`);
  }

  const { data: rows, error: rpcError } = await supabase.rpc("create_crm_receipt", {
    p_payment_id: paymentId,
  });
  if (rpcError) {
    throw new Error(`Failed to allocate receipt: ${rpcError.message}`);
  }
  const allocation = Array.isArray(rows) ? rows[0] : rows;
  if (!allocation) {
    throw new Error("Receipt allocation returned no row");
  }

  const receiptId = allocation.receipt_id as string;
  const receiptNumber = allocation.receipt_number as string;
  const alreadyExisted = Boolean(allocation.already_existed);

  if (alreadyExisted) {
    const { data: existing } = await supabase
      .from("receipts")
      .select("pdf_url")
      .eq("id", receiptId)
      .maybeSingle();
    return {
      receiptId,
      receiptNumber,
      alreadyExisted: true,
      pdfUrl: (existing?.pdf_url as string | null) ?? null,
    };
  }

  const { data: receipt } = await supabase
    .from("receipts")
    .select("id, amount, currency, issued_at, client_id, payment_id")
    .eq("id", receiptId)
    .single();
  if (!receipt) {
    throw new Error("Failed to load issued receipt");
  }

  const { data: pay } = await supabase
    .from("payments")
    .select("method, method_detail, reference, paid_at, invoice_id")
    .eq("id", paymentId)
    .single();

  const { data: invoice } = await supabase
    .from("invoices")
    .select("invoice_number")
    .eq("id", pay?.invoice_id)
    .maybeSingle();

  const { data: client } = await supabase
    .from("clients")
    .select("name")
    .eq("id", receipt.client_id)
    .maybeSingle();

  const pdfBuffer = await renderReceiptPdf({
    receiptNumber,
    issuedAt: new Date(receipt.issued_at as string),
    clientName: (client?.name as string | null) ?? "Client",
    invoiceNumber: (invoice?.invoice_number as string | null) ?? "—",
    amount: Number(receipt.amount),
    currency: receipt.currency as string,
    method: methodLabel((pay?.method as string) ?? "other"),
    methodDetail: (pay?.method_detail as string | null) ?? null,
    reference: (pay?.reference as string | null) ?? null,
    paidAt: pay?.paid_at ? new Date(pay.paid_at as string) : null,
  });

  const pdfKey = `billing/receipts/${receiptNumber}.pdf`;
  await putObject(pdfKey, pdfBuffer, "application/pdf");
  const pdfUrl = getPublicUrl(pdfKey);

  await supabase.from("receipts").update({ pdf_url: pdfUrl }).eq("id", receiptId);

  return { receiptId, receiptNumber, alreadyExisted: false, pdfUrl };
}
