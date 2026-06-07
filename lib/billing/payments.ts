import { createAdminClient } from "@/lib/supabase/admin";
import { notifyPaymentConfirmed } from "@/lib/billing/notifications";
import { generateReceipt } from "@/lib/billing/receipts";

export type ApplyPaymentResult = {
  invoiceId: string;
  invoicePaid: boolean;
  /** True only on the call that actually transitioned the invoice to paid. */
  transitioned: boolean;
  receiptId?: string;
  receiptNumber?: string;
};

export type ApplyPaymentOptions = {
  /** When true, do not roll the subscription period forward (onboard sets it explicitly). */
  skipPeriodAdvance?: boolean;
  /** Override invoice paid_at (e.g. onboard backdated payment). */
  paidAt?: string;
};

/** Advance a date forward by one billing cycle. */
function advanceByCycle(from: Date, cycle: string): Date {
  const next = new Date(from);
  if (cycle === "annual") {
    next.setFullYear(next.getFullYear() + 1);
  } else {
    next.setMonth(next.getMonth() + 1);
  }
  return next;
}

/**
 * Apply a confirmed payment to its invoice.
 *
 * When the sum of *confirmed* payments for the invoice covers its amount, the
 * invoice is marked paid, the subscription period rolls forward by one cycle
 * (unless skipPeriodAdvance), and the subscription is set back to `active`.
 *
 * Always generates a receipt for the confirmed payment (idempotent per payment).
 */
export async function applyPayment(
  paymentId: string,
  options?: ApplyPaymentOptions
): Promise<ApplyPaymentResult> {
  const supabase = createAdminClient();

  const { data: payment, error: payErr } = await supabase
    .from("payments")
    .select("id, invoice_id, status")
    .eq("id", paymentId)
    .single();
  if (payErr || !payment) {
    throw new Error(`Payment not found: ${payErr?.message ?? paymentId}`);
  }
  if (payment.status !== "confirmed") {
    throw new Error(`Payment ${paymentId} is not confirmed`);
  }

  const invoiceId = payment.invoice_id as string;

  const { data: invoice, error: invErr } = await supabase
    .from("invoices")
    .select("id, amount, currency, status, subscription_id, client_id, invoice_number")
    .eq("id", invoiceId)
    .single();
  if (invErr || !invoice) {
    throw new Error(`Invoice not found: ${invErr?.message ?? invoiceId}`);
  }

  let transitioned = false;
  const paidAtIso = options?.paidAt ?? new Date().toISOString();

  if (invoice.status !== "paid") {
    const { data: confirmed, error: sumErr } = await supabase
      .from("payments")
      .select("amount")
      .eq("invoice_id", invoiceId)
      .eq("status", "confirmed");
    if (sumErr) {
      throw new Error(`Failed to total payments: ${sumErr.message}`);
    }
    const paidTotal = (confirmed ?? []).reduce((sum, p) => sum + Number(p.amount), 0);

    if (paidTotal >= Number(invoice.amount)) {
      const { data: updatedRows, error: updErr } = await supabase
        .from("invoices")
        .update({ status: "paid", paid_at: paidAtIso, updated_at: new Date().toISOString() })
        .eq("id", invoiceId)
        .neq("status", "paid")
        .neq("status", "void")
        .select("id");
      if (updErr) {
        throw new Error(`Failed to mark invoice paid: ${updErr.message}`);
      }
      transitioned = (updatedRows?.length ?? 0) > 0;

      if (transitioned && !options?.skipPeriodAdvance) {
        const { data: sub } = await supabase
          .from("subscriptions")
          .select("id, billing_cycle, current_period_end")
          .eq("id", invoice.subscription_id)
          .single();

        if (sub) {
          const cycle = (sub.billing_cycle as string) ?? "monthly";
          const anchor = sub.current_period_end
            ? new Date(sub.current_period_end as string)
            : new Date();
          const newStart = anchor;
          const newEnd = advanceByCycle(anchor, cycle);
          await supabase
            .from("subscriptions")
            .update({
              current_period_start: newStart.toISOString(),
              current_period_end: newEnd.toISOString(),
              status: "active",
              updated_at: new Date().toISOString(),
            })
            .eq("id", sub.id);
        }
      } else if (transitioned && options?.skipPeriodAdvance) {
        await supabase
          .from("subscriptions")
          .update({ status: "active", updated_at: new Date().toISOString() })
          .eq("id", invoice.subscription_id);
      }

      if (transitioned) {
        try {
          const [{ data: client }, { data: sub }] = await Promise.all([
            supabase.from("clients").select("name").eq("id", invoice.client_id).maybeSingle(),
            supabase
              .from("subscriptions")
              .select("current_period_end")
              .eq("id", invoice.subscription_id)
              .maybeSingle(),
          ]);
          await notifyPaymentConfirmed({
            clientId: invoice.client_id as string,
            clientName: (client?.name as string | null) ?? "there",
            invoiceNumber: invoice.invoice_number as string,
            amount: Number(invoice.amount),
            currency: invoice.currency as string,
            nextRenewalDate: (sub?.current_period_end as string | null) ?? null,
          });
        } catch (e) {
          console.error("[applyPayment] payment confirmed notification failed:", e);
        }
      }
    }
  }

  let receiptId: string | undefined;
  let receiptNumber: string | undefined;
  try {
    const receipt = await generateReceipt(paymentId);
    receiptId = receipt.receiptId;
    receiptNumber = receipt.receiptNumber;
  } catch (e) {
    console.error("[applyPayment] receipt generation failed:", e);
  }

  const invoicePaid = invoice.status === "paid" || transitioned;

  return {
    invoiceId,
    invoicePaid,
    transitioned,
    receiptId,
    receiptNumber,
  };
}
